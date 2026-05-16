import { afterEach, describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { writeAnonymousUserData, type AnonymousUserData } from "../../src/auth/anonymous-user-data"
import { claimAnonymousIdentity } from "../../src/auth/claim-flow"

const tempHomes: string[] = []

async function createTempHome() {
  const home = await mkdtemp(join(tmpdir(), "composio-x-opencode-claim-flow-"))
  tempHomes.push(home)
  return home
}

afterEach(async () => {
  await Promise.all(tempHomes.splice(0).map((home) => rm(home, { recursive: true, force: true })))
})

function anonymousData(overrides: Partial<AnonymousUserData> = {}): AnonymousUserData {
  return {
    status: "ready",
    slug: "amber-cedar-otter",
    email: "amber-cedar-otter@agent.composio.ai",
    agent_key: "composio_agent_key_secret",
    composio: {
      org_id: "org_test",
      project_id: "project_test",
      api_key: "ak_test_secret",
      user_api_key: "uak_test_secret",
    },
    ...overrides,
  }
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  })
}

function createFetch(response: Response) {
  const calls: Array<{ url: Parameters<typeof fetch>[0]; init?: RequestInit }> = []
  const fetchImpl = (async (url: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const call: { url: Parameters<typeof fetch>[0]; init?: RequestInit } = { url }
    if (init !== undefined) call.init = init
    calls.push(call)
    return response
  }) as typeof fetch
  return { fetchImpl, calls }
}

function expectNoSecrets(value: unknown) {
  const out = JSON.stringify(value)
  expect(out).not.toContain("agent_key")
  expect(out).not.toContain("api_key")
  expect(out).not.toContain("user_api_key")
  expect(out).not.toContain("Authorization")
  expect(out).not.toContain("composio_agent_key_secret")
  expect(out).not.toContain("ak_test_secret")
  expect(out).not.toContain("uak_test_secret")
  expect(out).not.toContain("raw_invite_secret")
}

describe("claimAnonymousIdentity", () => {
  test("validates a single email before network access", async () => {
    const home = await createTempHome()
    const { fetchImpl, calls } = createFetch(jsonResponse({ status: "invited" }))

    await expect(claimAnonymousIdentity({ email: "not an email", home, fetchImpl })).rejects.toThrow("valid email")

    expect(calls).toHaveLength(0)
  })

  test("requires anonymous agent identity and guides users to signup first", async () => {
    const home = await createTempHome()
    const { fetchImpl, calls } = createFetch(jsonResponse({ status: "invited" }))

    await expect(claimAnonymousIdentity({ email: "owner@example.com", home, fetchImpl })).rejects.toThrow(
      "composio_signup",
    )
    expect(calls).toHaveLength(0)
  })

  test("posts claim request with anonymous agent authorization and returns safe invited summary", async () => {
    const home = await createTempHome()
    await writeAnonymousUserData(anonymousData(), { home })
    const { fetchImpl, calls } = createFetch(
      jsonResponse({ status: "INVITED", email: "owner@example.com", org_id: "org_test", invite_code: "raw_invite_secret" }),
    )

    const summary = await claimAnonymousIdentity({ email: " owner@example.com ", home, fetchImpl })

    expect(summary).toMatchObject({
      ok: true,
      status: "invited",
      email: "owner@example.com",
      orgId: "org_test",
      inviteCodePresent: true,
    })
    expect(summary.nextSteps.join(" ")).toContain("owner@example.com")
    expect(String(calls[0]?.url)).toBe("https://agents.composio.dev/api/claim")
    expect(calls[0]?.init?.method).toBe("POST")
    expect(calls[0]?.init?.headers).toEqual({
      Authorization: "Bearer composio_agent_key_secret",
      "content-type": "application/json",
    })
    expect(calls[0]?.init?.body).toBe(JSON.stringify({ email: "owner@example.com" }))
    expectNoSecrets(summary)
  })

  test("accepts nested data with camelCase response fields", async () => {
    const home = await createTempHome()
    await writeAnonymousUserData(anonymousData(), { home })
    const { fetchImpl } = createFetch(
      jsonResponse({ data: { status: "Pending", email: "owner@example.com", orgId: "org_nested", inviteCode: "raw_invite_secret" } }),
    )

    const summary = await claimAnonymousIdentity({ email: "owner@example.com", home, fetchImpl })

    expect(summary).toMatchObject({ status: "pending", orgId: "org_nested", inviteCodePresent: true })
    expectNoSecrets(summary)
  })

  test("redacts HTTP error payloads", async () => {
    const home = await createTempHome()
    await writeAnonymousUserData(anonymousData(), { home })
    const { fetchImpl } = createFetch(
      jsonResponse(
        {
          error: "bad Authorization Bearer composio_agent_key_secret ak_test_secret",
          Authorization: "Bearer composio_agent_key_secret",
          nested: { api_key: "ak_test_secret", user_api_key: "uak_test_secret" },
        },
        { status: 403, statusText: "Forbidden" },
      ),
    )

    try {
      await claimAnonymousIdentity({ email: "owner@example.com", home, fetchImpl })
      throw new Error("Expected claim to fail")
    } catch (error) {
      expect(JSON.stringify(error)).toContain("CLAIM_REQUEST_FAILED")
      expectNoSecrets(error)
    }
  })
})
