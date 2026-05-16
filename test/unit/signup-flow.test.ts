import { afterEach, describe, expect, test } from "bun:test"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { ensureAnonymousIdentity } from "../../src/auth/signup-flow"
import { getAnonymousUserDataPath, writeAnonymousUserData, type AnonymousUserData } from "../../src/auth/anonymous-user-data"

const tempHomes: string[] = []

async function createTempHome() {
  const home = await mkdtemp(join(tmpdir(), "composio-x-opencode-signup-flow-"))
  tempHomes.push(home)
  return home
}

afterEach(async () => {
  await Promise.all(tempHomes.splice(0).map((home) => rm(home, { recursive: true, force: true })))
})

function anonymousData(overrides: Partial<AnonymousUserData> = {}): AnonymousUserData {
  return {
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

function createSequenceFetch(responses: Response[]) {
  const calls: Array<{ url: Parameters<typeof fetch>[0]; init?: RequestInit }> = []
  const fetchImpl = (async (url: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const call: { url: Parameters<typeof fetch>[0]; init?: RequestInit } = { url }
    if (init !== undefined) call.init = init
    calls.push(call)
    const response = responses.shift()
    if (!response) throw new Error("Unexpected fetch call")
    return response
  }) as typeof fetch

  return { fetchImpl, calls }
}

function expectNoSecrets(value: unknown) {
  const out = JSON.stringify(value)
  expect(out).not.toContain("agent_key")
  expect(out).not.toContain("api_key")
  expect(out).not.toContain("user_api_key")
  expect(out).not.toContain("composio_agent_key_secret")
  expect(out).not.toContain("ak_test_secret")
  expect(out).not.toContain("uak_test_secret")
}

describe("ensureAnonymousIdentity", () => {
  test("signs up and persists credentials when no anonymous file exists", async () => {
    const home = await createTempHome()
    const payload = anonymousData()
    const { fetchImpl, calls } = createSequenceFetch([jsonResponse(payload)])

    const summary = await ensureAnonymousIdentity({ home, fetchImpl })

    expect(summary).toMatchObject({ ok: true, reused: false, source: "anonymous", slug: payload.slug })
    expect(summary.anonymousDataPath).toBe(getAnonymousUserDataPath(home))
    expectNoSecrets(summary)
    expect(String(calls[0]?.url)).toBe("https://agents.composio.dev/api/signup")

    const persisted = JSON.parse(await readFile(getAnonymousUserDataPath(home), "utf8"))
    expect(persisted).toEqual(payload)
  })

  test("reuses valid existing credentials only after whoami verification", async () => {
    const home = await createTempHome()
    await writeAnonymousUserData(anonymousData(), { home })
    const { fetchImpl, calls } = createSequenceFetch([jsonResponse({ status: "READY", slug: "verified-slug" })])

    const summary = await ensureAnonymousIdentity({ home, fetchImpl })

    expect(summary).toMatchObject({ ok: true, reused: true, slug: "verified-slug" })
    expectNoSecrets(summary)
    expect(String(calls[0]?.url)).toBe("https://agents.composio.dev/api/whoami")
  })

  test("freshly signs up when whoami rejects existing agent credentials", async () => {
    const home = await createTempHome()
    const fresh = anonymousData({ slug: "fresh-agent", agent_key: "composio_agent_key_fresh" })
    await writeAnonymousUserData(anonymousData(), { home })
    const { fetchImpl, calls } = createSequenceFetch([
      jsonResponse({ error: "revoked" }, { status: 401 }),
      jsonResponse(fresh),
    ])

    const summary = await ensureAnonymousIdentity({ home, fetchImpl })

    expect(summary).toMatchObject({ ok: true, reused: false, slug: "fresh-agent" })
    expect(String(calls[0]?.url)).toBe("https://agents.composio.dev/api/whoami")
    expect(String(calls[1]?.url)).toBe("https://agents.composio.dev/api/signup")

    const persisted = JSON.parse(await readFile(getAnonymousUserDataPath(home), "utf8"))
    expect(persisted.slug).toBe("fresh-agent")
  })

  test("throws pending signup error and does not persist credentials", async () => {
    const home = await createTempHome()
    const { fetchImpl } = createSequenceFetch([jsonResponse({ status: "pending" }, { status: 202 })])

    await expect(ensureAnonymousIdentity({ home, fetchImpl })).rejects.toThrow("pending")
    await expect(readFile(getAnonymousUserDataPath(home), "utf8")).rejects.toThrow()
  })

  test("uses wait=false as signup wait=0 and returns redacted shape", async () => {
    const home = await createTempHome()
    const { fetchImpl, calls } = createSequenceFetch([jsonResponse(anonymousData())])

    const summary = await ensureAnonymousIdentity({ home, fetchImpl, wait: false })

    expect(String(calls[0]?.url)).toBe("https://agents.composio.dev/api/signup?wait=0")
    expectNoSecrets(summary)
  })
})
