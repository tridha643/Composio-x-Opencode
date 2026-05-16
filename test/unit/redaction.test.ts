import { describe, expect, test } from "bun:test"

import { UserFacingError, toToolErrorPayload } from "../../src/auth/errors"
import { redactSecrets, redactString } from "../../src/auth/redact"

const SENTINELS = [
  "ak_test_secret",
  "uak_test_secret",
  "composio_agent_key_secret",
  "Bearer secret",
]

function expectNoSentinels(value: unknown) {
  const serialized = JSON.stringify(value)
  for (const sentinel of SENTINELS) {
    expect(serialized).not.toContain(sentinel)
  }
}

describe("redactString", () => {
  test("redacts known secret values and bearer tokens", () => {
    const output = redactString(
      "api=ak_test_secret user=uak_test_secret auth=Bearer secret",
      ["ak_test_secret", "uak_test_secret"],
    )

    expect(output).toContain("[REDACTED]")
    expectNoSentinels(output)
  })
})

describe("redactSecrets", () => {
  test("recursively redacts secret-shaped keys while preserving safe values", () => {
    const input = {
      status: "ready",
      request_id: "req_public",
      api_key: "ak_test_secret",
      nested: {
        userApiKey: "uak_test_secret",
        agent_key: "composio_agent_key_secret",
        authorization: "Bearer secret",
        safe: "hello",
      },
      items: [{ token: "Bearer secret" }, "safe-string"],
      count: 2,
      enabled: true,
    }

    const output = redactSecrets(input)

    expect(output).toEqual({
      status: "ready",
      request_id: "req_public",
      api_key: "[REDACTED]",
      nested: {
        userApiKey: "[REDACTED]",
        agent_key: "[REDACTED]",
        authorization: "[REDACTED]",
        safe: "hello",
      },
      items: [{ token: "[REDACTED]" }, "safe-string"],
      count: 2,
      enabled: true,
    })
    expectNoSentinels(output)
  })

  test("redacts known secret string values anywhere in nested output", () => {
    const output = redactSecrets(
      {
        message: "failed with ak_test_secret",
        nested: ["uak_test_secret", { safeKey: "Bearer secret" }],
      },
      ["ak_test_secret", "uak_test_secret", "Bearer secret"],
    )

    expectNoSentinels(output)
    expect(JSON.stringify(output)).toContain("[REDACTED]")
  })
})

describe("UserFacingError", () => {
  test("serializes safe code, message, and redacted details", () => {
    const error = new UserFacingError("AUTH_FAILED", "Authentication failed", {
      api_key: "ak_test_secret",
      body: "Authorization: Bearer secret",
    })

    const payload = toToolErrorPayload(error)

    expect(payload).toEqual({
      ok: false,
      code: "AUTH_FAILED",
      message: "Authentication failed",
      details: {
        api_key: "[REDACTED]",
        body: "Authorization: [REDACTED]",
      },
    })
    expectNoSentinels(payload)
  })

  test("converts unknown errors without leaking secret-bearing messages", () => {
    const payload = toToolErrorPayload(new Error("request used ak_test_secret"), ["ak_test_secret"])

    expect(payload.ok).toBe(false)
    expect(payload.code).toBe("UNKNOWN_ERROR")
    expectNoSentinels(payload)
  })
})
