import { afterEach, describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
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

  test("signup, claim, Phase 3 meta tools, Phase 4 trigger tools, and handoff are real", async () => {
    const { hooks } = await loadPluginWithFetchGuard()
    const dir = await mkdtemp(join(tmpdir(), "composio-x-opencode-plugin-"))
    const signupTool = hooks.tool?.composio_signup as ToolDefinition | undefined
    const claimTool = hooks.tool?.composio_claim as ToolDefinition | undefined
    const metaTool = hooks.tool?.composio_search_tools as ToolDefinition | undefined
    const triggerTool = hooks.tool?.composio_list_trigger_types as ToolDefinition | undefined
    const handoffTool = hooks.tool?.save_automation_definition as ToolDefinition | undefined

    try {
      expect(signupTool?.description).toContain("official agent signup flow")
      expect(claimTool?.description).toContain("anonymous Composio identity")
      expect(metaTool?.description).toContain("Composio's tool catalog")
      expect(triggerTool?.description).toContain("trigger types")
      expect(handoffTool?.description).toContain("Pi-compatible automation definition")

      const signupResult = await signupTool?.execute({}, createToolContext())
      const claimResult = await claimTool?.execute({ email: "owner@example.com" }, createToolContext())
      globalThis.fetch = (async () => {
        throw new Error("Phase 3 real tool test must not contact Composio")
      }) as unknown as typeof fetch
      const metaResult = await metaTool?.execute({ queries: [{ use_case: "send an email" }] }, createToolContext())
      const triggerResult = await triggerTool?.execute({ toolkit_slugs: ["github"] }, createToolContext())
      globalThis.fetch = ORIGINAL_FETCH
      const handoffResult = await handoffTool?.execute(
        {
          name: "Plugin handoff",
          triggerId: "trg_plugin",
          triggerSlug: "PLUGIN_EVENT",
          instructions: "Handle plugin event.",
          filePath: join(dir, "automations.json"),
        },
        createToolContext(),
      )
      const signupParsed = JSON.parse(typeof signupResult === "string" ? signupResult : signupResult?.output ?? "{}")
      const claimParsed = JSON.parse(typeof claimResult === "string" ? claimResult : claimResult?.output ?? "{}")
      const metaParsed = JSON.parse(typeof metaResult === "string" ? metaResult : metaResult?.output ?? "{}")
      const triggerParsed = JSON.parse(typeof triggerResult === "string" ? triggerResult : triggerResult?.output ?? "{}")
      const handoffParsed = JSON.parse(typeof handoffResult === "string" ? handoffResult : handoffResult?.output ?? "{}")

      expect(signupParsed.code).not.toBe("not_implemented_in_phase_1")
      expect(claimParsed.code).not.toBe("not_implemented_in_phase_1")
      expect(metaParsed.code).not.toBe("not_implemented_in_phase_1")
      expect(triggerParsed.code).not.toBe("not_implemented_in_phase_1")
      expect(handoffParsed).toMatchObject({
        ok: true,
        operation: "inserted",
        automation: {
          name: "Plugin handoff",
          triggerId: "trg_plugin",
          triggerSlug: "PLUGIN_EVENT",
        },
      })
    } finally {
      globalThis.fetch = ORIGINAL_FETCH
      await rm(dir, { recursive: true, force: true })
    }
  })
})
