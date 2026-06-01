import { spawn } from "node:child_process"
import { tool, type ToolDefinition } from "@opencode-ai/plugin"

import { readAnonymousUserData } from "../auth/anonymous-user-data"
import { redactSecrets } from "../auth/redact"
import { resolveComposioAuth, type ResolveComposioAuthOptions } from "../auth/resolve-auth"
import { formatToolResult } from "./format"

const DEFAULT_TIMEOUT_MS = 120_000
const MAX_TIMEOUT_MS = 1_800_000
const DEFAULT_MAX_OUTPUT_BYTES = 1_000_000
const MAX_OUTPUT_BYTES = 5_000_000

type CliRunResult = {
  ok: boolean
  command: string[]
  exitCode: number | null
  signal: NodeJS.Signals | null
  stdout: string
  stderr: string
  timedOut: boolean
  truncated: boolean
}

export type RunComposioCli = (options: {
  argv: string[]
  stdin?: string
  cwd: string
  timeoutMs: number
  maxOutputBytes: number
}) => Promise<CliRunResult>

export type CreateComposioCliToolOptions = ResolveComposioAuthOptions & {
  runCli?: RunComposioCli
}

function clampNumber(value: number | undefined, fallback: number, max: number): number {
  if (value === undefined) return fallback
  return Math.min(Math.max(Math.trunc(value), 1), max)
}

async function collectKnownSecrets(options: ResolveComposioAuthOptions): Promise<string[]> {
  const secrets: string[] = []
  const auth = await resolveComposioAuth(options).catch(() => null)
  if (auth?.apiKey) secrets.push(auth.apiKey)

  const anonymousData = await readAnonymousUserData(
    options.home === undefined ? {} : { home: options.home },
  ).catch(() => null)
  if (anonymousData?.agent_key) secrets.push(anonymousData.agent_key)
  if (anonymousData?.composio?.api_key) secrets.push(anonymousData.composio.api_key)
  if (anonymousData?.composio?.user_api_key) secrets.push(anonymousData.composio.user_api_key)

  return secrets
}

function appendChunk(current: string, chunk: Buffer, state: { bytes: number; truncated: boolean }, maxBytes: number): string {
  if (state.bytes >= maxBytes) {
    state.truncated = true
    return current
  }

  const remaining = maxBytes - state.bytes
  state.bytes += chunk.byteLength
  if (chunk.byteLength > remaining) {
    state.truncated = true
    return current + chunk.subarray(0, remaining).toString("utf8")
  }

  return current + chunk.toString("utf8")
}

export function runComposioCli(options: Parameters<RunComposioCli>[0]): Promise<CliRunResult> {
  return new Promise((resolve) => {
    const child = spawn("composio", options.argv, {
      cwd: options.cwd,
      env: process.env,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    })

    let stdout = ""
    let stderr = ""
    let timedOut = false
    const outputState = { bytes: 0, truncated: false }
    const timer = setTimeout(() => {
      timedOut = true
      child.kill("SIGTERM")
    }, options.timeoutMs)

    child.stdout.on("data", (chunk: Buffer) => {
      stdout = appendChunk(stdout, chunk, outputState, options.maxOutputBytes)
    })
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = appendChunk(stderr, chunk, outputState, options.maxOutputBytes)
    })
    child.on("error", (error) => {
      clearTimeout(timer)
      resolve({
        ok: false,
        command: ["composio", ...options.argv],
        exitCode: null,
        signal: null,
        stdout,
        stderr: error instanceof Error ? error.message : String(error),
        timedOut,
        truncated: outputState.truncated,
      })
    })
    child.on("close", (exitCode, signal) => {
      clearTimeout(timer)
      resolve({
        ok: exitCode === 0,
        command: ["composio", ...options.argv],
        exitCode,
        signal,
        stdout,
        stderr,
        timedOut,
        truncated: outputState.truncated,
      })
    })

    if (options.stdin !== undefined) child.stdin.end(options.stdin)
    else child.stdin.end()
  })
}

export function createComposioCliTool(options: CreateComposioCliToolOptions = {}): ToolDefinition {
  const runCli = options.runCli ?? runComposioCli

  return tool({
    description:
      "Worst-case fallback that invokes the authenticated local Composio CLI with unrestricted Composio CLI arguments. This can mutate external services; it is not a shell, but `composio run` may execute CLI-supported scripts.",
    args: {
      argv: tool.schema.array(tool.schema.string()).min(1),
      stdin: tool.schema.string().optional(),
      timeout_ms: tool.schema.number().int().positive().max(MAX_TIMEOUT_MS).optional(),
      max_output_bytes: tool.schema.number().int().positive().max(MAX_OUTPUT_BYTES).optional(),
    },
    async execute(args, context) {
      const timeoutMs = clampNumber(args.timeout_ms, DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS)
      const maxOutputBytes = clampNumber(args.max_output_bytes, DEFAULT_MAX_OUTPUT_BYTES, MAX_OUTPUT_BYTES)
      const secrets = await collectKnownSecrets(options)
      const cliOptions: Parameters<RunComposioCli>[0] = {
        argv: args.argv,
        cwd: context.directory,
        timeoutMs,
        maxOutputBytes,
      }
      if (args.stdin !== undefined) cliOptions.stdin = args.stdin

      const result = await runCli(cliOptions)

      return formatToolResult("Composio CLI complete", {
        ...redactSecrets(result, secrets) as Record<string, unknown>,
        timeoutMs,
        maxOutputBytes,
      }, secrets)
    },
  })
}
