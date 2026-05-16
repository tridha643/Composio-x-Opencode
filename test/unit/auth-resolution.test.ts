import { afterEach, describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { writeAnonymousUserData, type AnonymousUserData } from "../../src/auth/anonymous-user-data"
import { getMissingCredentialMessage, resolveComposioAuth } from "../../src/auth/resolve-auth"

const tempHomes: string[] = []

async function createTempHome() {
  const home = await mkdtemp(join(tmpdir(), "composio-x-opencode-resolve-"))
  tempHomes.push(home)
  return home
}

afterEach(async () => {
  await Promise.all(tempHomes.splice(0).map((home) => rm(home, { recursive: true, force: true })))
})

function anonymousData(apiKey = "ak_anonymous_secret"): AnonymousUserData {
  return {
    status: "ready",
    request_id: "req_test",
    slug: "agent-test",
    agent_key: "composio_agent_key_secret",
    composio: {
      member_id: "member_test",
      org_id: "org_test",
      project_id: "project_test",
      api_key: apiKey,
      user_api_key: "uak_test_secret",
    },
  }
}

describe("resolveComposioAuth", () => {
  test("uses trimmed COMPOSIO_API_KEY for env-only auth", async () => {
    const home = await createTempHome()
    const auth = await resolveComposioAuth({ env: { COMPOSIO_API_KEY: "  ak_env_secret  " }, home })

    expect(auth.apiKey).toBe("ak_env_secret")
    expect(auth.source).toBe("env")
    expect(auth.debug).toEqual({
      apiKeyPresent: true,
      authSource: "env",
      envKeyPrecedence: true,
      anonymousDataPresent: false,
    })
    expect(auth.anonymousPath).toBe(join(home, ".composio", "anonymous_user_data.json"))
  })

  test("falls back to anonymous api key when env is absent", async () => {
    const home = await createTempHome()
    await writeAnonymousUserData(anonymousData("  ak_anonymous_secret  "), { home })

    const auth = await resolveComposioAuth({ env: {}, home })

    expect(auth.apiKey).toBe("ak_anonymous_secret")
    expect(auth.source).toBe("anonymous")
    expect(auth.debug).toEqual({
      apiKeyPresent: true,
      authSource: "anonymous",
      envKeyPrecedence: false,
      anonymousDataPresent: true,
    })
  })

  test("gives env key precedence over anonymous credentials", async () => {
    const home = await createTempHome()
    await writeAnonymousUserData(anonymousData("ak_anonymous_secret"), { home })

    const auth = await resolveComposioAuth({ env: { COMPOSIO_API_KEY: "ak_env_secret" }, home })

    expect(auth.apiKey).toBe("ak_env_secret")
    expect(auth.source).toBe("env")
    expect(auth.debug.envKeyPrecedence).toBe(true)
    expect(auth.debug.anonymousDataPresent).toBe(true)
  })

  test("treats empty env strings as missing and falls back to anonymous credentials", async () => {
    const home = await createTempHome()
    await writeAnonymousUserData(anonymousData("ak_anonymous_secret"), { home })

    const auth = await resolveComposioAuth({ env: { COMPOSIO_API_KEY: "   " }, home })

    expect(auth.apiKey).toBe("ak_anonymous_secret")
    expect(auth.source).toBe("anonymous")
  })

  test("returns unauthenticated metadata for malformed anonymous data", async () => {
    const home = await createTempHome()
    await writeAnonymousUserData({ status: "ready", composio: { api_key: "   " } }, { home })

    const auth = await resolveComposioAuth({ env: {}, home })

    expect(auth.apiKey).toBeUndefined()
    expect(auth.source).toBeNull()
    expect(auth.debug).toEqual({
      apiKeyPresent: false,
      authSource: null,
      envKeyPrecedence: false,
      anonymousDataPresent: true,
    })
  })
})

describe("getMissingCredentialMessage", () => {
  test("guides agents to composio_signup before manual key setup", () => {
    const message = getMissingCredentialMessage()

    expect(message).toContain("composio_signup")
    expect(message.toLowerCase()).toContain("first")
    expect(message.indexOf("composio_signup")).toBeLessThan(message.toLowerCase().indexOf("manual"))
  })
})
