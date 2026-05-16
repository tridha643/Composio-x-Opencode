import { afterEach, describe, expect, test } from "bun:test"
import type { PluginInput, ToolDefinition } from "@opencode-ai/plugin"

import plugin from "../../src/index"
import { COMPOSIO_TOOL_NAMES } from "../../src/plugin/manifest"

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
    $: (() => {}) as PluginInput["$"],
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
  }) as typeof fetch

  try {
    const hooks = await plugin(createPluginInput())
    return { hooks, fetchCalls }
  } finally {
    globalThis.fetch = originalFetch
  }
}

afterEach(() => {
  // Keep later tests insulated if an assertion throws before helper cleanup.
  globalThis.fetch = fetch
})

describe("default opencode plugin export", () => {
  test("registers every manifest tool without startup network fetch", async () => {
    const { hooks, fetchCalls } = await loadPluginWithFetchGuard()

    expect(fetchCalls).toHaveLength(0)
    expect(hooks.tool).toBeDefined()
    expect(Object.keys(hooks.tool ?? {})).toEqual([...COMPOSIO_TOOL_NAMES])
  })

  test("composio_debug_info returns registered tool names without credentials", async () => {
    const { hooks, fetchCalls } = await loadPluginWithFetchGuard()
    const debugTool = hooks.tool?.composio_debug_info as ToolDefinition | undefined

    expect(debugTool).toBeDefined()

    const result = await debugTool?.execute({}, createToolContext())

    expect(fetchCalls).toHaveLength(0)
    expect(result).toBeObject()

    const output = typeof result === "string" ? result : result?.output
    const parsed = JSON.parse(output ?? "{}")

    expect(parsed.ok).toBe(true)
    expect(parsed.registered).toBe(true)
    expect(parsed.registeredTools).toEqual([...COMPOSIO_TOOL_NAMES])
  })
})
