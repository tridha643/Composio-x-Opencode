import { describe, expect, test } from "bun:test"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { getAnonymousUserDataPath } from "../../src/auth/anonymous-user-data"
import { whoAmI } from "../../src/auth/agent-api"
import { ensureAnonymousIdentity } from "../../src/auth/signup-flow"

const shouldRun = process.env.RUN_COMPOSIO_LIVE_AGENT_TESTS === "1"

describe("live Composio agent signup contract", () => {
  test("is skipped unless RUN_COMPOSIO_LIVE_AGENT_TESTS=1", async () => {
    if (!shouldRun) {
      expect(shouldRun).toBe(false)
      return
    }

    const home = await mkdtemp(join(tmpdir(), "composio-x-opencode-live-agent-"))

    try {
      const summary = await ensureAnonymousIdentity({ home, baseUrl: "https://agents.composio.dev" })
      expect(summary.status.toLowerCase()).toBe("ready")
      expect(summary.reused).toBe(false)

      const filePath = getAnonymousUserDataPath(home)
      const persistedText = await readFile(filePath, "utf8")
      const persisted = JSON.parse(persistedText)

      expect(typeof persisted.agent_key).toBe("string")
      expect(typeof persisted.composio?.api_key).toBe("string")

      const verified = await whoAmI(persisted.agent_key, { baseUrl: "https://agents.composio.dev" })
      expect(verified.status?.toLowerCase()).toBe("ready")

      const output = JSON.stringify(summary)
      expect(output).not.toContain(persisted.agent_key)
      expect(output).not.toContain(persisted.composio.api_key)
      if (persisted.composio.user_api_key) {
        expect(output).not.toContain(persisted.composio.user_api_key)
      }
      expect(output).not.toContain("agent_key")
      expect(output).not.toContain("api_key")
      expect(output).not.toContain("user_api_key")
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  }, 60_000)
})
