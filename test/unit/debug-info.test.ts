import { afterEach, describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { writeAnonymousUserData, type AnonymousUserData } from "../../src/auth/anonymous-user-data"
import { COMPOSIO_TOOL_NAMES } from "../../src/plugin/manifest"
import { PACKAGE_NAME, PACKAGE_VERSION } from "../../src/shared/version"
import { createDebugInfoTool } from "../../src/tools/debug-info"

const tempHomes: string[] = []
const SENTINELS = [
  "ak_env_secret",
  "ak_anonymous_secret",
  "uak_test_secret",
  "composio_agent_key_secret",
  "Bearer secret",
]

async function createTempHome() {
  const home = await mkdtemp(join(tmpdir(), "composio-x-opencode-debug-"))
  tempHomes.push(home)
  return home
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

async function executeDebugInfo(options: Parameters<typeof createDebugInfoTool>[0]) {
  const result = await createDebugInfoTool(options).execute({}, createToolContext())
  const output = typeof result === "string" ? result : result.output
  return JSON.parse(output ?? "{}")
}

function expectNoSentinels(value: unknown) {
  const serialized = JSON.stringify(value)
  for (const sentinel of SENTINELS) {
    expect(serialized).not.toContain(sentinel)
  }
}

afterEach(async () => {
  await Promise.all(tempHomes.splice(0).map((home) => rm(home, { recursive: true, force: true })))
})

describe("createDebugInfoTool", () => {
  test("reports env auth precedence without exposing COMPOSIO_API_KEY", async () => {
    const home = await createTempHome()
    await writeAnonymousUserData(anonymousData(), { home })

    const parsed = await executeDebugInfo({ env: { COMPOSIO_API_KEY: "ak_env_secret" }, home })

    expect(parsed.packageName).toBe(PACKAGE_NAME)
    expect(parsed.packageVersion).toBe(PACKAGE_VERSION)
    expect(parsed.auth).toEqual({
      source: "env",
      apiKeyPresent: true,
      envKeyPrecedence: true,
      anonymousDataPath: join(home, ".composio", "anonymous_user_data.json"),
      anonymousDataPresent: true,
    })
    expect(parsed.handoff.anonymousIdentityPresent).toBe(true)
    expectNoSentinels(parsed)
  })

  test("falls back to anonymous credential metadata without printing anonymous secrets", async () => {
    const home = await createTempHome()
    await writeAnonymousUserData(anonymousData(), { home })

    const parsed = await executeDebugInfo({ env: {}, home })

    expect(parsed.auth.source).toBe("anonymous")
    expect(parsed.auth.apiKeyPresent).toBe(true)
    expect(parsed.auth.envKeyPrecedence).toBe(false)
    expect(parsed.auth.anonymousDataPresent).toBe(true)
    expect(parsed.handoff.anonymousIdentityPresent).toBe(true)
    expectNoSentinels(parsed)
  })

  test("reports no credentials while preserving handoff and registered tool fields", async () => {
    const home = await createTempHome()

    const parsed = await executeDebugInfo({ env: {}, home })

    expect(parsed.auth.source).toBeNull()
    expect(parsed.auth.apiKeyPresent).toBe(false)
    expect(parsed.auth.envKeyPrecedence).toBe(false)
    expect(parsed.auth.anonymousDataPresent).toBe(false)
    expect(parsed.handoff).toEqual({
      tool: "composio_claim",
      command: "/composio-claim <email>",
      anonymousIdentityPresent: false,
    })
    expect(parsed.registeredTools).toEqual([...COMPOSIO_TOOL_NAMES])
    expect(parsed.redaction).toEqual({ enabled: true, secretValuesPrinted: false })
    expectNoSentinels(parsed)
  })
})
