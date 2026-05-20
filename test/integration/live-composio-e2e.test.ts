import { describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { deleteTrigger, disableTrigger } from "../../src/composio/triggers"
import { createSaveAutomationDefinitionTool } from "../../src/tools/automation-definition"
import { createGetToolSchemasTool, createSearchToolsTool } from "../../src/tools/meta"
import {
  createCreateTriggerTool,
  createDeleteTriggerTool,
  createDisableTriggerTool,
  createEnableTriggerTool,
  createGetTriggerTypeSchemaTool,
  createListTriggerTypesTool,
  createListTriggersTool,
} from "../../src/tools/triggers"

type JsonRecord = Record<string, unknown>

const shouldRun = process.env.RUN_COMPOSIO_LIVE_E2E_TESTS === "1"

function createToolContext(directory = process.cwd()) {
  return {
    sessionID: "live-composio-e2e-session",
    messageID: "live-composio-e2e-message",
    agent: "live-composio-e2e-agent",
    directory,
    worktree: directory,
    abort: new AbortController().signal,
    metadata() {},
    ask: (() => {}) as never,
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`${name} is required when RUN_COMPOSIO_LIVE_E2E_TESTS=1`)
  }
  return value
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value && value.length > 0 ? value : undefined
}

function parseJsonEnv(name: string): JsonRecord {
  const raw = requiredEnv(name)
  const parsed = JSON.parse(raw) as unknown
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${name} must be a JSON object`)
  }
  return parsed as JsonRecord
}

function outputOf(result: unknown): string {
  if (typeof result === "string") return result
  if (result && typeof result === "object" && "output" in result) {
    const output = (result as { output?: unknown }).output
    if (typeof output === "string") return output
  }
  return JSON.stringify(result)
}

function parseOutput(result: unknown): JsonRecord {
  return JSON.parse(outputOf(result)) as JsonRecord
}

function expectNoSecretOutput(result: unknown, apiKey: string): void {
  const output = outputOf(result)
  expect(output).not.toContain(apiKey)
  expect(output).not.toContain(`Bearer ${apiKey}`)
  expect(output).not.toContain("COMPOSIO_API_KEY")
}

function expectOk(result: unknown, apiKey: string): JsonRecord {
  expectNoSecretOutput(result, apiKey)
  const parsed = parseOutput(result)
  expect(parsed.ok).toBe(true)
  return parsed
}

function triggerIdFrom(payload: JsonRecord, label: string): string {
  const triggerId = payload.triggerId
  if (typeof triggerId !== "string" || triggerId.trim().length === 0) {
    throw new Error(`${label} did not return a triggerId`)
  }
  return triggerId
}

describe("live Composio E2E contract", () => {
  test("is skipped unless RUN_COMPOSIO_LIVE_E2E_TESTS=1", async () => {
    if (!shouldRun) {
      expect(shouldRun).toBe(false)
      return
    }

    const apiKey = requiredEnv("COMPOSIO_API_KEY")
    const toolSchemaSlug = requiredEnv("COMPOSIO_LIVE_TOOL_SCHEMA_SLUG")
    const triggerSlug = requiredEnv("COMPOSIO_LIVE_TRIGGER_SLUG")
    const initialTriggerConfig = parseJsonEnv("COMPOSIO_LIVE_TRIGGER_CONFIG_JSON")
    const updatedTriggerConfig = parseJsonEnv("COMPOSIO_LIVE_TRIGGER_UPDATED_CONFIG_JSON")
    const connectedAccountId = optionalEnv("COMPOSIO_LIVE_CONNECTED_ACCOUNT_ID")
    const triggerToolkitSlug = optionalEnv("COMPOSIO_LIVE_TRIGGER_TOOLKIT_SLUG")
    const searchUseCase = optionalEnv("COMPOSIO_LIVE_TOOL_SEARCH_USE_CASE") ?? "inspect a public repository"
    const env: Record<string, string | undefined> = { COMPOSIO_API_KEY: apiKey }
    const userId = optionalEnv("COMPOSIO_USER_ID")
    if (userId !== undefined) env.COMPOSIO_USER_ID = userId

    const dir = await mkdtemp(join(tmpdir(), "composio-x-opencode-live-e2e-"))
    const context = createToolContext(dir)
    const createdTriggerIds = new Set<string>()

    try {
      const sessionCache = new Map<string, string>()
      const searchResult = await createSearchToolsTool({ env, sessionCache }).execute(
        { queries: [{ use_case: searchUseCase }] },
        context,
      )
      const searchPayload = expectOk(searchResult, apiKey)
      expect(searchPayload.upstreamSlug).toBe("COMPOSIO_SEARCH_TOOLS")

      const schemaResult = await createGetToolSchemasTool({ env, sessionCache }).execute(
        { tool_slugs: [toolSchemaSlug], include: ["input_schema", "output_schema"] },
        context,
      )
      const schemaPayload = expectOk(schemaResult, apiKey)
      expect(schemaPayload.upstreamSlug).toBe("COMPOSIO_GET_TOOL_SCHEMAS")

      const triggerTypeArgs = triggerToolkitSlug === undefined ? { limit: 10 } : { toolkit_slugs: [triggerToolkitSlug], limit: 10 }
      const triggerTypesResult = await createListTriggerTypesTool({ env }).execute(triggerTypeArgs, context)
      const triggerTypesPayload = expectOk(triggerTypesResult, apiKey)
      expect(triggerTypesPayload.endpoint).toBe("GET /api/v3.1/triggers_types")

      const triggerSchemaResult = await createGetTriggerTypeSchemaTool({ env }).execute({ slug: triggerSlug }, context)
      const triggerSchemaPayload = expectOk(triggerSchemaResult, apiKey)
      expect(triggerSchemaPayload.slug).toBe(triggerSlug)

      const createArgs = {
        slug: triggerSlug,
        trigger_config: initialTriggerConfig,
        ...(connectedAccountId === undefined ? {} : { connected_account_id: connectedAccountId }),
      }
      const createResult = await createCreateTriggerTool({ env }).execute(createArgs, context)
      const createPayload = expectOk(createResult, apiKey)
      const createdTriggerId = triggerIdFrom(createPayload, "Initial trigger upsert")
      createdTriggerIds.add(createdTriggerId)

      const updateArgs = {
        slug: triggerSlug,
        trigger_config: updatedTriggerConfig,
        ...(connectedAccountId === undefined ? {} : { connected_account_id: connectedAccountId }),
      }
      const updateResult = await createCreateTriggerTool({ env }).execute(updateArgs, context)
      const updatePayload = expectOk(updateResult, apiKey)
      const updatedTriggerId = triggerIdFrom(updatePayload, "Updated trigger upsert")
      createdTriggerIds.add(updatedTriggerId)

      const listResult = await createListTriggersTool({ env }).execute(
        { trigger_ids: [...createdTriggerIds], trigger_names: [triggerSlug], show_disabled: true, limit: 20 },
        context,
      )
      const listPayload = expectOk(listResult, apiKey)
      for (const triggerId of createdTriggerIds) {
        expect(JSON.stringify(listPayload)).toContain(triggerId)
      }

      const handoffResult = await createSaveAutomationDefinitionTool().execute(
        {
          name: "Live Composio E2E fixture",
          triggerId: updatedTriggerId,
          triggerSlug,
          instructions: "Disposable live E2E automation fixture. Safe to delete after the test run.",
          enabled: true,
          metadata: { source: "composio-x-opencode-live-e2e" },
          filePath: join(dir, "automations.json"),
        },
        context,
      )
      const handoffPayload = expectOk(handoffResult, apiKey)
      expect(handoffPayload.operation).toMatch(/inserted|updated/)

      const disableResult = await createDisableTriggerTool({ env }).execute({ trigger_id: updatedTriggerId }, context)
      const disablePayload = expectOk(disableResult, apiKey)
      expect(disablePayload.status).toBe("disabled")

      const enableResult = await createEnableTriggerTool({ env }).execute({ trigger_id: updatedTriggerId }, context)
      const enablePayload = expectOk(enableResult, apiKey)
      expect(enablePayload.status).toBe("enabled")

      const finalDisableResult = await createDisableTriggerTool({ env }).execute({ trigger_id: updatedTriggerId }, context)
      const finalDisablePayload = expectOk(finalDisableResult, apiKey)
      expect(finalDisablePayload.status).toBe("disabled")

      for (const triggerId of [...createdTriggerIds]) {
        const deleteResult = await createDeleteTriggerTool({ env }).execute({ trigger_id: triggerId, confirm: true }, context)
        const deletePayload = expectOk(deleteResult, apiKey)
        expect(deletePayload.status).toBe("deleted")
        createdTriggerIds.delete(triggerId)
      }
    } finally {
      for (const triggerId of createdTriggerIds) {
        try {
          await disableTrigger({ triggerId }, { env })
        } catch {
          // Best-effort cleanup continues with delete below.
        }
        try {
          await deleteTrigger({ triggerId }, { env })
        } catch (error) {
          console.warn(`live Composio E2E cleanup failed for ${triggerId}: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
      await rm(dir, { recursive: true, force: true })
    }
  }, 180_000)
})
