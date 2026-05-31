import { afterEach, describe, expect, test } from "bun:test"
import { existsSync } from "node:fs"
import { readFile, mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, dirname, join } from "node:path"
import type { ToolContext } from "@opencode-ai/plugin"

import { createSaveAutomationDefinitionTool } from "../../src/tools/handoff"

const tempHomes: string[] = []

async function createTempHome() {
  const home = await mkdtemp(join(tmpdir(), "composio-x-opencode-handoff-"))
  tempHomes.push(home)
  return home
}

function createToolContext(): ToolContext {
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

afterEach(async () => {
  await Promise.all(tempHomes.splice(0).map((home) => rm(home, { recursive: true, force: true })))
})

describe("save_automation_definition", () => {
  test("writes a local Composio handoff artifact", async () => {
    const home = await createTempHome()
    const tool = createSaveAutomationDefinitionTool({ home })
    const result = await tool.execute({
      name: "Daily GitHub digest",
      steps: [{ tool: "GITHUB_LIST_REPOSITORY_ISSUES", args: { owner: "openai" } }],
      metadata: { owner: "tri" },
    }, createToolContext())
    const parsed = JSON.parse(typeof result === "string" ? result : result.output)

    expect(parsed.ok).toBe(true)
    expect(parsed.automationId).toStartWith("auto_daily-github-digest_")
    expect(dirname(parsed.path)).toBe(join(home, ".composio", "opencode", "automations"))
    expect(basename(parsed.path)).toBe(`${parsed.automationId}.json`)
    expect(existsSync(parsed.path)).toBe(true)

    const artifact = JSON.parse(await readFile(parsed.path, "utf8"))
    expect(artifact).toMatchObject({
      id: parsed.automationId,
      schemaVersion: 1,
      source: "composio-x-opencode",
      definition: {
        name: "Daily GitHub digest",
        steps: [{ tool: "GITHUB_LIST_REPOSITORY_ISSUES", args: { owner: "openai" } }],
      },
    })
  })
})
