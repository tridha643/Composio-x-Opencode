import { describe, expect, test } from "bun:test"

import { signUpAgent, whoAmI } from "../../src/auth/agent-api"
import { UserFacingError } from "../../src/auth/errors"

type FetchCall = {
  url: URL | RequestInfo
  init?: RequestInit
}

const signupPayload = {
  status: "ready",
  request_id: "req_test",
  slug: "amber-cedar-otter",
  email: "amber-cedar-otter@agent.composio.ai",
  agent_key: "composio_agent_key_secret",
  composio: {
    member_id: "member_test",
    org_id: "org_test",
    project_id: "project_test",
    api_key: "ak_test_secret",
    user_api_key: "uak_test_secret",
  },
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  })
}

function createFetch(response: Response) {
  const calls: FetchCall[] = []
  const fetchImpl = (async (url: URL | RequestInfo, init?: RequestInit) => {
    calls.push({ url, init })
    return response.clone()
  }) as typeof fetch

  return { fetchImpl, calls }
}

function serialized(error: unknown) {
  return JSON.stringify(error)
}

describe("signUpAgent", () => {
  test("posts to the official signup endpoint with JSON body and no wait query by default", async () => {
    const { fetchImpl, calls } = createFetch(jsonResponse(signupPayload))

    const result = await signUpAgent({ fetchImpl, baseUrl: "https://agents.composio.dev" })

    expect(result).toEqual(signupPayload)
    expect(calls).toHaveLength(1)
    expect(String(calls[0]?.url)).toBe("https://agents.composio.dev/api/signup")
    expect(calls[0]?.init?.method).toBe("POST")
    expect(calls[0]?.init?.headers).toEqual({ "content-type": "application/json" })
    expect(calls[0]?.init?.body).toBe("{}")
  })

  test("uses wait=0 only when wait is explicitly false", async () => {
    const { fetchImpl, calls } = createFetch(jsonResponse(signupPayload))

    await signUpAgent({ fetchImpl, baseUrl: "https://agents.composio.dev/", wait: false })

    await signUpAgent({ fetchImpl, baseUrl: "https://agents.composio.dev/", wait: true })

    await signUpAgent({ fetchImpl, baseUrl: "https://agents.composio.dev/" })

    expect(String(calls[0]?.url)).toBe("https://agents.composio.dev/api/signup?wait=0")
    expect(String(calls[1]?.url)).toBe("https://agents.composio.dev/api/signup")
    expect(String(calls[2]?.url)).toBe("https://agents.composio.dev/api/signup")
  })

  test("accepts case-insensitive ready status and camelCase response variants", async () => {
    const payload = {
      status: "READY",
      requestId: "req_test",
      agentKey: "composio_agent_key_secret",
      composio: {
        orgId: "org_test",
        projectId: "project_test",
        apiKey: "ak_test_secret",
        userApiKey: "uak_test_secret",
      },
    }
    const { fetchImpl } = createFetch(jsonResponse({ data: payload }))

    const result = await signUpAgent({ fetchImpl })

    expect(result.status).toBe("READY")
    expect(result.agent_key).toBe("composio_agent_key_secret")
    expect(result.composio?.api_key).toBe("ak_test_secret")
    expect(result.composio?.user_api_key).toBe("uak_test_secret")
  })

  test("throws actionable pending and HTTP errors without raw response secrets", async () => {
    const { fetchImpl } = createFetch(
      jsonResponse(
        { message: "try later", agent_key: "composio_agent_key_secret", api_key: "ak_test_secret" },
        { status: 202, statusText: "Accepted" },
      ),
    )

    await expect(signUpAgent({ fetchImpl })).rejects.toThrow(UserFacingError)

    try {
      await signUpAgent({ fetchImpl })
    } catch (error) {
      const out = serialized(error)
      expect(out).toContain("AGENT_SIGNUP_PENDING")
      expect(out).not.toContain("composio_agent_key_secret")
      expect(out).not.toContain("ak_test_secret")
    }
  })

  test("redacts secrets from invalid JSON and invalid response shape errors", async () => {
    const invalidJson = createFetch(new Response("{not-json ak_test_secret", { status: 200 }))
    await expect(signUpAgent({ fetchImpl: invalidJson.fetchImpl })).rejects.toThrow("invalid JSON")

    const invalidShape = createFetch(jsonResponse({ status: "ready", composio: { api_key: "ak_test_secret" } }))
    await expect(signUpAgent({ fetchImpl: invalidShape.fetchImpl })).rejects.toThrow("unexpected response shape")

    try {
      await signUpAgent({ fetchImpl: invalidShape.fetchImpl })
    } catch (error) {
      expect(serialized(error)).not.toContain("ak_test_secret")
    }
  })
})

describe("whoAmI", () => {
  test("gets whoami with bearer authorization", async () => {
    const { fetchImpl, calls } = createFetch(jsonResponse({ ...signupPayload, status: "READY" }))

    const result = await whoAmI("composio_agent_key_secret", { fetchImpl, baseUrl: "https://agents.composio.dev" })

    expect(result.status).toBe("READY")
    expect(String(calls[0]?.url)).toBe("https://agents.composio.dev/api/whoami")
    expect(calls[0]?.init?.method).toBe("GET")
    expect(calls[0]?.init?.headers).toEqual({ Authorization: "Bearer composio_agent_key_secret" })
  })

  test("redacts raw authorization and response secrets from whoami errors", async () => {
    const { fetchImpl } = createFetch(
      jsonResponse(
        { error: "bad Bearer composio_agent_key_secret", api_key: "ak_test_secret" },
        { status: 401, statusText: "Unauthorized" },
      ),
    )

    try {
      await whoAmI("composio_agent_key_secret", { fetchImpl })
    } catch (error) {
      const out = serialized(error)
      expect(out).toContain("AGENT_WHOAMI_FAILED")
      expect(out).not.toContain("composio_agent_key_secret")
      expect(out).not.toContain("ak_test_secret")
      expect(out).not.toContain("Authorization")
    }
  })
})
