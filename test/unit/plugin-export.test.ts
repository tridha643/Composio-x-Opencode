import { afterEach, describe, expect, test } from "bun:test"
import type { Plugin, PluginInput, ToolDefinition } from "@opencode-ai/plugin"

import plugin from "../../src/index"
import { COMPOSIO_TOOL_NAMES } from "../../src/plugin/manifest"

const ORIGINAL_FETCH = globalThis.fetch
const typedPlugin = plugin as Plugin

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

async function loadPluginWithFetchGuard() {
  const fetchCalls: unknown[] = []
  const originalFetch = globalThis.fetch

  globalThis.fetch = ((...args: Parameters<typeof fetch>) => {
    fetchCalls.push(args)
    throw new Error("Plugin initialization must not call fetch")
  }) as unknown as typeof fetch

  try {
    const hooks = await typedPlugin(createPluginInput())
    return { hooks, fetchCalls }
  } finally {
    globalThis.fetch = originalFetch
  }
}

afterEach(() => {
  // Keep later tests insulated if an assertion throws before helper cleanup.
  globalThis.fetch = ORIGINAL_FETCH
})

describe("default opencode plugin export", () => {
  test("registers every manifest tool without startup network fetch", async () => {
    const { hooks, fetchCalls } = await loadPluginWithFetchGuard()

    expect(fetchCalls).toHaveLength(0)
    expect(hooks.tool).toBeDefined()
    expect(Object.keys(hooks.tool ?? {})).toEqual([...COMPOSIO_TOOL_NAMES])
  })

  test("composio_debug_info returns redacted auth metadata without credentials", async () => {
    const { hooks, fetchCalls } = await loadPluginWithFetchGuard()
    const debugTool = hooks.tool?.composio_debug_info as ToolDefinition | undefined

    expect(debugTool).toBeDefined()

    const result = await debugTool?.execute({}, createToolContext())

    expect(fetchCalls).toHaveLength(0)
    expect(result).toBeObject()

    const output = typeof result === "string" ? result : result?.output
    const parsed = JSON.parse(output ?? "{}")

    expect(parsed.auth).toMatchObject({
      apiKeyPresent: expect.any(Boolean),
      envKeyPrecedence: expect.any(Boolean),
      anonymousDataPresent: expect.any(Boolean),
    })
    expect(parsed.handoff).toMatchObject({
      tool: "composio_claim",
      command: "/composio-claim <email>",
      anonymousIdentityPresent: expect.any(Boolean),
    })
    expect(parsed.registeredTools).toEqual([...COMPOSIO_TOOL_NAMES])
    expect(parsed.redaction).toEqual({ enabled: true, secretValuesPrinted: false })
    expect(JSON.stringify(parsed)).not.toContain("COMPOSIO_API_KEY")
    expect(JSON.stringify(parsed)).not.toContain("api_key")
  })

  test("signup and claim are real Phase 2 tools while future tools remain placeholders", async () => {
    const { hooks } = await loadPluginWithFetchGuard()
    const signupTool = hooks.tool?.composio_signup as ToolDefinition | undefined
    const claimTool = hooks.tool?.composio_claim as ToolDefinition | undefined
    const futureTool = hooks.tool?.composio_search_tools as ToolDefinition | undefined

    expect(signupTool?.description).toContain("official agent signup flow")
    expect(claimTool?.description).toContain("anonymous Composio identity")

    const signupResult = await signupTool?.execute({}, createToolContext())
    const claimResult = await claimTool?.execute({ email: "owner@example.com" }, createToolContext())
    const futureResult = await futureTool?.execute({}, createToolContext())
    const signupParsed = JSON.parse(typeof signupResult === "string" ? signupResult : signupResult?.output ?? "{}")
    const claimParsed = JSON.parse(typeof claimResult === "string" ? claimResult : claimResult?.output ?? "{}")
    const futureParsed = JSON.parse(typeof futureResult === "string" ? futureResult : futureResult?.output ?? "{}")

    expect(signupParsed.code).not.toBe("not_implemented_in_phase_1")
    expect(claimParsed.code).not.toBe("not_implemented_in_phase_1")
    expect(futureParsed).toMatchObject({
      ok: false,
      code: "not_implemented_in_phase_1",
      tool: "composio_search_tools",
    })
  })
})
