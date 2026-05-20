import { describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { UserFacingError, toToolErrorPayload } from "../../src/auth/errors"
import { requestComposioJson } from "../../src/composio/client"

describe("requestComposioJson", () => {
  test("guides users to composio_signup when credentials are missing", async () => {
    const home = await mkdtemp(join(tmpdir(), "composio-client-missing-auth-"))
    let called = false

    try {
      await requestComposioJson(
        { path: "/api/v3.1/tool_router/session", body: { user_id: "user_test" } },
        {
          env: {},
          home,
          fetchImpl: (async () => {
            called = true
            return new Response("{}")
          }) as unknown as typeof fetch,
        },
      )
    } catch (error) {
      await rm(home, { recursive: true, force: true })
      expect(called).toBe(false)
      expect(error).toBeInstanceOf(UserFacingError)
      const payload = toToolErrorPayload(error)
      expect(payload.code).toBe("MISSING_COMPOSIO_CREDENTIALS")
      expect(payload.message).toContain("composio_signup")
      return
    }

    await rm(home, { recursive: true, force: true })
    throw new Error("Expected missing credential error")
  })

  test("sends bearer auth and parses JSON responses", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = []
    const result = await requestComposioJson(
      { path: "/api/v3.1/tool_router/session", body: { user_id: "user_test" } },
      {
        env: { COMPOSIO_API_KEY: "ak_env_secret" },
        fetchImpl: (async (url, init) => {
          calls.push({ url: String(url), init: init ?? {} })
          return Response.json({ session_id: "trs_test" })
        }) as typeof fetch,
      },
    )

    expect(result).toEqual({ session_id: "trs_test" })
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe("https://backend.composio.dev/api/v3.1/tool_router/session")
    expect(calls[0]?.init.method).toBe("POST")
    expect(calls[0]?.init.headers).toMatchObject({ authorization: "Bearer ak_env_secret" })
  })

  test("normalizes and redacts HTTP errors", async () => {
    try {
      await requestComposioJson(
        { path: "/api/v3.1/tool_router/session", body: { user_id: "user_test" } },
        {
          env: { COMPOSIO_API_KEY: "ak_env_secret" },
          fetchImpl: (async () =>
            Response.json(
              {
                message: "failed with Bearer ak_env_secret",
                api_key: "ak_env_secret",
                nested: { token: "secret_token" },
              },
              { status: 401, statusText: "Unauthorized" },
            )) as unknown as typeof fetch,
        },
      )
    } catch (error) {
      const serialized = JSON.stringify(toToolErrorPayload(error))

      expect(serialized).toContain("COMPOSIO_HTTP_ERROR")
      expect(serialized).not.toContain("ak_env_secret")
      expect(serialized).not.toContain("Bearer ak_env_secret")
      expect(serialized).not.toContain("secret_token")
      return
    }

    throw new Error("Expected HTTP error")
  })
})
