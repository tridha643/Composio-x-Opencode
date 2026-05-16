import { describe, expect, test } from "bun:test"

import { UserFacingError } from "../../src/auth/errors"
import { createClaimTool, createSignupTool } from "../../src/tools/auth"

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

function expectNoSecrets(value: unknown) {
  const out = typeof value === "string" ? value : JSON.stringify(value)
  expect(out).not.toContain("agent_key")
  expect(out).not.toContain("api_key")
  expect(out).not.toContain("user_api_key")
  expect(out).not.toContain("Authorization")
  expect(out).not.toContain("composio_agent_key_secret")
  expect(out).not.toContain("ak_test_secret")
  expect(out).not.toContain("uak_test_secret")
  expect(out).not.toContain("raw_invite_secret")
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

    expect(typeof result).not.toBe("string")
    if (typeof result !== "string") expect(parsed).toEqual(result.metadata)
    expect(parsed.ok).toBe(true)
    expect(parsed.reused).toBe(true)
    expectNoSecrets(parsed)
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
    expectNoSecrets(out)
  })
})

describe("createClaimTool", () => {
  test("executes claim service and returns safe status with next steps", async () => {
    const tool = createClaimTool({
      home: "/tmp/test-home",
      service: async (options) => ({
        ok: true,
        status: "invited",
        email: options.email,
        orgId: "org_test",
        inviteCodePresent: true,
        nextSteps: ["Check owner@example.com for the invite", "Accept the invite to claim the org"],
      }),
    })

    const result = await tool.execute({ email: "owner@example.com" }, createToolContext())
    const parsed = JSON.parse(outputOf(result))

    expect(typeof result).not.toBe("string")
    if (typeof result !== "string") expect(parsed).toEqual(result.metadata)
    expect(parsed).toMatchObject({ ok: true, status: "invited", email: "owner@example.com" })
    expect(parsed.nextSteps.join(" ")).toContain("Accept")
    expectNoSecrets(result)
  })

  test("guides users to composio_signup when anonymous identity is missing", async () => {
    const tool = createClaimTool({
      service: async () => {
        throw new UserFacingError(
          "MISSING_ANONYMOUS_IDENTITY",
          "No anonymous Composio agent identity was found. Run composio_signup first, then retry composio_claim.",
        )
      },
    })

    const result = await tool.execute({ email: "owner@example.com" }, createToolContext())
    const out = outputOf(result)
    const parsed = JSON.parse(out)

    expect(parsed.ok).toBe(false)
    expect(parsed.code).toBe("MISSING_ANONYMOUS_IDENTITY")
    expect(parsed.message).toContain("composio_signup")
    expectNoSecrets(out)
  })

  test("serializes claim errors without credential or authorization sentinels", async () => {
    const tool = createClaimTool({
      service: async () => {
        throw new UserFacingError("CLAIM_REQUEST_FAILED", "failed without exposing Authorization", {
          agent_key: "composio_agent_key_secret",
          api_key: "ak_test_secret",
          user_api_key: "uak_test_secret",
          invite_code: "raw_invite_secret",
        })
      },
    })

    const result = await tool.execute({ email: "owner@example.com" }, createToolContext())
    const out = outputOf(result)

    expect(JSON.parse(out).ok).toBe(false)
    expectNoSecrets(out)
  })
})
