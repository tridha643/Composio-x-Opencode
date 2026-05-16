import { afterEach, describe, expect, test } from "bun:test"
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import type { Plugin, PluginInput, ToolDefinition } from "@opencode-ai/plugin"

import { COMPOSIO_TOOL_NAMES } from "../../src/plugin/manifest"

const ORIGINAL_FETCH = globalThis.fetch

function createPluginInput(): PluginInput {
  return {
    client: {} as PluginInput["client"],
    project: {} as PluginInput["project"],
    directory: process.cwd(),
    worktree: process.cwd(),
    experimental_workspace: {
      register() {},
    },
    serverUrl: new URL("http://localhost"),
    $: (() => {}) as unknown as PluginInput["$"],
  }
}

function createToolContext() {
  return {
    sessionID: "test-session",
    messageID: "test-message",
    agent: "test-agent",
    directory: process.cwd(),
    worktree: process.cwd(),
    abort: new AbortController().signal,
    metadata() {},
    ask: (() => {}) as never,
  }
}

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH
})

describe("local build output", () => {
  test("loads dist/index.js, registers static tools, and runs debug info without network", async () => {
    const distIndexPath = resolve(process.cwd(), "dist/index.js")
    const fetchCalls: unknown[] = []

    globalThis.fetch = ((...args: Parameters<typeof fetch>) => {
      fetchCalls.push(args)
      throw new Error("Built plugin local load must not call fetch")
    }) as unknown as typeof fetch

    if (!existsSync(distIndexPath)) {
      throw new Error("dist/index.js is missing. Run `bun run build` before `bun run test:integration`.")
    }

    const builtModule = (await import(pathToFileURL(distIndexPath).href)) as {
      default?: Plugin
    }

    expect(builtModule.default).toBeFunction()
    const builtPlugin = builtModule.default as Plugin

    const hooks = await builtPlugin(createPluginInput())

    expect(Object.keys(hooks.tool ?? {})).toEqual([...COMPOSIO_TOOL_NAMES])

    const debugTool = hooks.tool?.composio_debug_info as ToolDefinition | undefined
    const result = await debugTool?.execute({}, createToolContext())
    const parsed = JSON.parse(typeof result === "string" ? result : result?.output ?? "{}")

    expect(fetchCalls).toHaveLength(0)
    expect(parsed.packageName).toBe("composio-x-opencode")
    expect(parsed.packageVersion).toBe("0.1.0")
    expect(parsed.auth).toBeObject()
    expect(parsed.handoff).toMatchObject({
      tool: "composio_claim",
      command: "/composio-claim <email>",
    })
    expect(parsed.registeredTools).toEqual([...COMPOSIO_TOOL_NAMES])
    expect(parsed.redaction?.enabled).toBe(true)
  })
})
