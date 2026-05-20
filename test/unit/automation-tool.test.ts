import { describe, expect, test } from "bun:test"

import { UserFacingError } from "../../src/auth/errors"
import { createSaveAutomationDefinitionTool } from "../../src/tools/automation-definition"

function createToolContext(directory = process.cwd()) {
  return {
    sessionID: "test-session",
    messageID: "test-message",
    agent: "test-agent",
    directory,
    worktree: directory,
    abort: new AbortController().signal,
    metadata() {},
    ask: (() => {}) as never,
  }
}

function outputOf(result: Awaited<ReturnType<ReturnType<typeof createSaveAutomationDefinitionTool>["execute"]>>) {
  return typeof result === "string" ? result : result.output
}

describe("save_automation_definition tool", () => {
  test("maps opencode args to the Pi-compatible handoff service", async () => {
    const tool = createSaveAutomationDefinitionTool({
      saveAutomationDefinitionService: async (input, options) => ({
        ok: true,
        filePath: options.cwd ? `${options.cwd}/automations.json` : "automations.json",
        operation: "inserted",
        automation: {
          ...input,
          updatedAt: "2026-05-20T12:00:00.000Z",
        },
      }),
    })

    const result = await tool.execute(
      {
        name: "Linear triage",
        triggerId: "trg_123",
        triggerSlug: "LINEAR_ISSUE_CREATED",
        instructions: "Create a follow-up task.",
        enabled: true,
        metadata: { owner: "support" },
        filePath: "automations.json",
      },
      createToolContext("/tmp/opencode-project"),
    )
    const parsed = JSON.parse(outputOf(result))

    expect(parsed).toMatchObject({
      ok: true,
      filePath: "/tmp/opencode-project/automations.json",
      operation: "inserted",
      automation: {
        name: "Linear triage",
        triggerId: "trg_123",
        triggerSlug: "LINEAR_ISSUE_CREATED",
        instructions: "Create a follow-up task.",
        enabled: true,
        metadata: { owner: "support" },
      },
    })
  })

  test("returns redacted service errors instead of throwing", async () => {
    const tool = createSaveAutomationDefinitionTool({
      saveAutomationDefinitionService: async () => {
        throw new UserFacingError("HANDOFF_FAILED", "failed with ak_env_secret", {
          api_key: "ak_env_secret",
          filePath: "/tmp/automations.json",
        })
      },
    })

    const result = await tool.execute(
      {
        name: "Broken",
        triggerId: "trg_broken",
        triggerSlug: "BROKEN_EVENT",
        instructions: "Report the failure.",
      },
      createToolContext(),
    )
    const out = outputOf(result)
    const parsed = JSON.parse(out)

    expect(parsed).toMatchObject({ ok: false, code: "HANDOFF_FAILED" })
    expect(parsed.details).toEqual({ filePath: "/tmp/automations.json" })
    expect(out).not.toContain("ak_env_secret")
    expect(out).not.toContain("api_key")
  })
})
