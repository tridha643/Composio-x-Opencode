import { describe, expect, test } from "bun:test"

import { buildComposioToolRegistry } from "../../src/plugin/register-tools"

const shouldRun = process.env.RUN_COMPOSIO_LIVE_RUNTIME_TESTS === "1"

function createToolContext() {
  return {
    sessionID: `live-runtime-${Date.now()}`,
    messageID: "live-message",
    agent: "live-agent",
    directory: process.cwd(),
    worktree: process.cwd(),
    abort: new AbortController().signal,
    metadata() {},
    ask: (() => {}) as never,
  }
}

describe("live Composio runtime contract", () => {
  test("is skipped unless RUN_COMPOSIO_LIVE_RUNTIME_TESTS=1", () => {
    if (shouldRun) {
      expect(process.env.COMPOSIO_API_KEY).toBeString()
      expect(process.env.COMPOSIO_API_KEY?.trim()).not.toBe("")
    } else {
      expect(shouldRun).toBe(false)
    }
  })

  test.if(shouldRun)("creates a Tool Router session and searches no-OAuth tools", async () => {
    if (!process.env.COMPOSIO_API_KEY?.trim()) {
      throw new Error("COMPOSIO_API_KEY is required when RUN_COMPOSIO_LIVE_RUNTIME_TESTS=1")
    }

    const registry = buildComposioToolRegistry()
    const result = await registry.composio_search_tools.execute({
      queries: ["Find a no-auth Hacker News tool for reading public stories"],
      user_id: process.env.COMPOSIO_USER_ID || `opencode-live-${Date.now()}`,
    }, createToolContext())
    const parsed = JSON.parse(typeof result === "string" ? result : result.output)

    expect(parsed.ok).toBe(true)
    expect(parsed.sessionId).toBeString()
    expect(JSON.stringify(parsed)).not.toContain(process.env.COMPOSIO_API_KEY)
  })
})
