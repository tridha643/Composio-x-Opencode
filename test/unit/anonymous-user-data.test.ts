import { afterEach, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

import {
  getAnonymousUserDataPath,
  readAnonymousUserData,
  writeAnonymousUserData,
  type AnonymousUserData,
} from "../../src/auth/anonymous-user-data"

const tempHomes: string[] = []

async function createTempHome() {
  const home = await mkdtemp(join(tmpdir(), "composio-x-opencode-auth-"))
  tempHomes.push(home)
  return home
}

afterEach(async () => {
  await Promise.all(tempHomes.splice(0).map((home) => rm(home, { recursive: true, force: true })))
})

function fixture(overrides: Partial<AnonymousUserData> = {}): AnonymousUserData {
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

describe("getAnonymousUserDataPath", () => {
  test("resolves to the required global Composio anonymous data path", async () => {
    const home = await createTempHome()

    expect(getAnonymousUserDataPath(home)).toBe(join(home, ".composio", "anonymous_user_data.json"))
  })
})

describe("readAnonymousUserData", () => {
  test("returns null for missing files", async () => {
    const home = await createTempHome()

    expect(await readAnonymousUserData({ home })).toBeNull()
  })

  test("returns null for invalid JSON and schema-lite invalid files", async () => {
    const home = await createTempHome()
    const path = getAnonymousUserDataPath(home)

    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, "{not-json")
    expect(await readAnonymousUserData({ home })).toBeNull()

    await Bun.write(path, JSON.stringify({ status: "ready", composio: "not-an-object" }))
    expect(await readAnonymousUserData({ home })).toBeNull()
  })

  test("reads a valid anonymous credential file", async () => {
    const home = await createTempHome()
    const data = fixture()

    await writeAnonymousUserData(data, { home })

    expect(await readAnonymousUserData({ home })).toEqual(data)
  })
})

describe("writeAnonymousUserData", () => {
  test("writes formatted JSON atomically to anonymous data path", async () => {
    const home = await createTempHome()
    const data = fixture()
    const path = getAnonymousUserDataPath(home)

    await writeAnonymousUserData(data, { home })

    const content = await readFile(path, "utf8")

    expect(content).toBe(`${JSON.stringify(data, null, 2)}\n`)
    expect(await readAnonymousUserData({ home })).toEqual(data)
  })

  test("uses restrictive file permissions on POSIX platforms", async () => {
    const home = await createTempHome()
    const path = getAnonymousUserDataPath(home)

    await writeAnonymousUserData(fixture(), { home })

    const fileMode = (await stat(path)).mode & 0o777
    const dirMode = (await stat(join(home, ".composio"))).mode & 0o777

    if (process.platform !== "win32") {
      expect(fileMode).toBe(0o600)
      expect(dirMode & 0o077).toBe(0)
    }
  })
})
