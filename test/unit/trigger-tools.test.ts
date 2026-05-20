import { describe, expect, test } from "bun:test"

import { UserFacingError } from "../../src/auth/errors"
import {
  type CreateTriggerToolOptions,
  createCreateTriggerTool,
  createDeleteTriggerTool,
  createDisableTriggerTool,
  createEnableTriggerTool,
  createGetTriggerTypeSchemaTool,
  createListTriggerTypesTool,
  createListTriggersTool,
} from "../../src/tools/triggers"

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

function outputOf(result: Awaited<ReturnType<ReturnType<typeof createListTriggerTypesTool>["execute"]>>) {
  return typeof result === "string" ? result : result.output
}

describe("Phase 4 trigger tools", () => {
  test("maps tools to trigger services with structured results", async () => {
    const calls: Array<{ name: string; input: unknown }> = []
    const options: CreateTriggerToolOptions = {
      listTriggerTypesService: async (input) => {
        calls.push({ name: "list-types", input })
        return { ok: true, items: [{ slug: "GITHUB_COMMIT_EVENT" }] }
      },
      getTriggerTypeSchemaService: async (input) => {
        calls.push({ name: "schema", input })
        return { ok: true, slug: input.slug, config: { required: ["owner"] } }
      },
      createTriggerService: async (input) => {
        calls.push({ name: "create", input })
        return { ok: true, triggerId: "trig_123", slug: input.slug }
      },
      listTriggersService: async (input) => {
        calls.push({ name: "list", input })
        return { ok: true, items: [{ id: "trig_123" }] }
      },
      enableTriggerService: async (input) => {
        calls.push({ name: "enable", input })
        return { ok: true, triggerId: input.triggerId, status: "enabled" }
      },
      disableTriggerService: async (input) => {
        calls.push({ name: "disable", input })
        return { ok: true, triggerId: input.triggerId, status: "disabled" }
      },
      deleteTriggerService: async (input) => {
        calls.push({ name: "delete", input })
        return { ok: true, triggerId: input.triggerId, status: "deleted" }
      },
    }

    const results = await Promise.all([
      createListTriggerTypesTool(options).execute({ toolkit_slugs: ["github"], limit: 5 }, createToolContext()),
      createGetTriggerTypeSchemaTool(options).execute({ slug: "GITHUB_COMMIT_EVENT" }, createToolContext()),
      createCreateTriggerTool(options).execute(
        { slug: "GITHUB_COMMIT_EVENT", trigger_config: { owner: "composio" }, connected_account_id: "ca_123" },
        createToolContext(),
      ),
      createListTriggersTool(options).execute({ trigger_names: ["GITHUB_COMMIT_EVENT"], show_disabled: true }, createToolContext()),
      createEnableTriggerTool(options).execute({ trigger_id: "trig_123" }, createToolContext()),
      createDisableTriggerTool(options).execute({ trigger_id: "trig_123" }, createToolContext()),
      createDeleteTriggerTool(options).execute({ trigger_id: "trig_123", confirm: true }, createToolContext()),
    ])

    for (const result of results) {
      expect(typeof result).not.toBe("string")
      expect(JSON.parse(outputOf(result))).toMatchObject({ ok: true })
    }
    expect(calls.map((call) => call.name)).toEqual(["list-types", "schema", "create", "list", "enable", "disable", "delete"])
    expect(calls[0]?.input).toMatchObject({ toolkitSlugs: ["github"], limit: 5 })
    expect(calls[2]?.input).toMatchObject({ slug: "GITHUB_COMMIT_EVENT", triggerConfig: { owner: "composio" }, connectedAccountId: "ca_123" })
  })

  test("blocks destructive delete without explicit confirmation", async () => {
    let called = false
    const tool = createDeleteTriggerTool({
      deleteTriggerService: async () => {
        called = true
        return { ok: true }
      },
    })

    const result = await tool.execute({ trigger_id: "trig_123", confirm: false }, createToolContext())
    const parsed = JSON.parse(outputOf(result))

    expect(called).toBe(false)
    expect(parsed).toMatchObject({ ok: false, code: "TRIGGER_DELETE_CONFIRMATION_REQUIRED" })
    expect(parsed.message).toContain("permanently deletes")
  })

  test("returns redacted service errors instead of throwing", async () => {
    const tool = createListTriggerTypesTool({
      listTriggerTypesService: async () => {
        throw new UserFacingError("TRIGGER_API_FAILED", "failed with ak_env_secret", {
          api_key: "ak_env_secret",
          authorization: "Bearer ak_env_secret",
        })
      },
    })

    const result = await tool.execute({}, createToolContext())
    const out = outputOf(result)
    const parsed = JSON.parse(out)

    expect(parsed).toMatchObject({ ok: false, code: "TRIGGER_API_FAILED" })
    expect(out).not.toContain("ak_env_secret")
    expect(out).not.toContain("authorization")
  })

  test("descriptions distinguish schema lookup, pause, and destructive delete", () => {
    expect(createGetTriggerTypeSchemaTool().description).toMatch(/schema|Never guess/i)
    expect(createDisableTriggerTool().description).toMatch(/pauses|without deleting/i)
    expect(createDeleteTriggerTool().description).toMatch(/Permanently|Destructive|irreversible/i)
  })
})
