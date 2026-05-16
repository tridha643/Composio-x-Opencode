import { describe, expect, test } from "bun:test"

import { UserFacingError } from "../../src/auth/errors"
import { createSignupTool } from "../../src/tools/auth"

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

function outputOf(result: Awaited<ReturnType<ReturnType<typeof createSignupTool>["execute"]>>) {
  return typeof result === "string" ? result : result.output
}

describe("createSignupTool", () => {
  test("executes signup service and returns safe structured JSON", async () => {
    const tool = createSignupTool({
      service: async (options) => ({
        ok: true,
        status: "ready",
        reused: Boolean(options.wait),
        source: "anonymous",
        slug: "amber-cedar-otter",
        email: "amber-cedar-otter@agent.composio.ai",
        orgId: "org_test",
        projectId: "project_test",
        anonymousDataPath: "/tmp/anonymous_user_data.json",
        restrictivePermissions: true,
      }),
    })

    const result = await tool.execute({ wait: true }, createToolContext())
    const parsed = JSON.parse(outputOf(result))

    expect(parsed).toEqual(result.metadata)
    expect(parsed.ok).toBe(true)
    expect(parsed.reused).toBe(true)
    expect(JSON.stringify(parsed)).not.toContain("agent_key")
    expect(JSON.stringify(parsed)).not.toContain("api_key")
    expect(JSON.stringify(parsed)).not.toContain("user_api_key")
    expect(JSON.stringify(parsed)).not.toContain("ak_test_secret")
  })

  test("converts signup errors through redacted tool error payloads", async () => {
    const tool = createSignupTool({
      service: async () => {
        throw new UserFacingError("AGENT_SIGNUP_FAILED", "failed with ak_test_secret", {
          agent_key: "composio_agent_key_secret",
          api_key: "ak_test_secret",
          nested: { user_api_key: "uak_test_secret" },
        })
      },
    })

    const result = await tool.execute({}, createToolContext())
    const out = outputOf(result)
    const parsed = JSON.parse(out)

    expect(parsed.ok).toBe(false)
    expect(parsed.code).toBe("AGENT_SIGNUP_FAILED")
    expect(out).not.toContain("composio_agent_key_secret")
    expect(out).not.toContain("ak_test_secret")
    expect(out).not.toContain("uak_test_secret")
  })
})
