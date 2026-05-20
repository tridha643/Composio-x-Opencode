import { describe, expect, test } from "bun:test"

import { requestComposioJson } from "../../src/composio/client"
import {
  createTrigger,
  deleteTrigger,
  disableTrigger,
  enableTrigger,
  getTriggerTypeSchema,
  listTriggerTypes,
  listTriggers,
} from "../../src/composio/triggers"

function createFetch(responses: unknown[]) {
  const calls: Array<{ url: string; init: RequestInit; body: unknown }> = []
  const fetchImpl = (async (url, init) => {
    calls.push({
      url: String(url),
      init: init ?? {},
      body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
    })

    const response = responses.shift()
    if (response === null) return new Response(null, { status: 204 })
    return Response.json(response ?? {})
  }) as typeof fetch

  return { calls, fetchImpl }
}

const authOptions = { env: { COMPOSIO_API_KEY: "ak_env_secret" } }

describe("Phase 4 trigger service", () => {
  test("lists trigger types with v3.1 query filters", async () => {
    const { calls, fetchImpl } = createFetch([{ items: [{ slug: "GITHUB_COMMIT_EVENT" }], next_cursor: "next" }])

    const result = await listTriggerTypes(
      {
        toolkitSlugs: ["github", "gmail"],
        toolkitVersions: { github: "12082025_00" },
        limit: 20,
        cursor: "cur",
      },
      { ...authOptions, fetchImpl },
    )
    const url = new URL(calls[0]?.url ?? "")

    expect(calls[0]?.init.method).toBe("GET")
    expect(url.pathname).toBe("/api/v3.1/triggers_types")
    expect(url.searchParams.getAll("toolkit_slugs")).toEqual(["github", "gmail"])
    expect(url.searchParams.get("toolkit_versions[github]")).toBe("12082025_00")
    expect(url.searchParams.get("limit")).toBe("20")
    expect(url.searchParams.get("cursor")).toBe("cur")
    expect(result).toMatchObject({ ok: true, items: [{ slug: "GITHUB_COMMIT_EVENT" }], pagination: { nextCursor: "next" } })
  })

  test("gets trigger schema by slug", async () => {
    const { calls, fetchImpl } = createFetch([
      { slug: "GITHUB_COMMIT_EVENT", config: { required: ["owner", "repo"] }, payload: { properties: {} } },
    ])

    const result = await getTriggerTypeSchema(
      { slug: "GITHUB_COMMIT_EVENT", toolkitVersions: "latest" },
      { ...authOptions, fetchImpl },
    )
    const url = new URL(calls[0]?.url ?? "")

    expect(calls[0]?.init.method).toBe("GET")
    expect(url.pathname).toBe("/api/v3.1/triggers_types/GITHUB_COMMIT_EVENT")
    expect(url.searchParams.get("toolkit_versions")).toBe("latest")
    expect(result).toMatchObject({ ok: true, slug: "GITHUB_COMMIT_EVENT", config: { required: ["owner", "repo"] } })
  })

  test("creates triggers through upsert with non-deprecated snake_case fields", async () => {
    const { calls, fetchImpl } = createFetch([{ trigger_id: "trig_123", deprecated: { uuid: "uuid_123" } }])

    const result = await createTrigger(
      {
        slug: "GITHUB_COMMIT_EVENT",
        connectedAccountId: "ca_123",
        triggerConfig: { owner: "composio", repo: "sdk" },
        toolkitVersions: { github: "12082025_00" },
      },
      { ...authOptions, fetchImpl },
    )

    expect(calls[0]).toMatchObject({
      url: "https://backend.composio.dev/api/v3.1/trigger_instances/GITHUB_COMMIT_EVENT/upsert",
      body: {
        connected_account_id: "ca_123",
        trigger_config: { owner: "composio", repo: "sdk" },
        toolkit_versions: { github: "12082025_00" },
      },
    })
    expect(result).toMatchObject({ ok: true, operation: "upsert", triggerId: "trig_123", status: "created_or_updated" })
  })

  test("lists existing trigger instances with filters", async () => {
    const { calls, fetchImpl } = createFetch([{ items: [{ id: "trig_123", trigger_name: "GITHUB_COMMIT_EVENT" }] }])

    const result = await listTriggers(
      {
        userIds: ["user_1"],
        connectedAccountIds: ["ca_1"],
        triggerIds: ["trig_123"],
        triggerNames: ["GITHUB_COMMIT_EVENT"],
        showDisabled: true,
        limit: 10,
      },
      { ...authOptions, fetchImpl },
    )
    const url = new URL(calls[0]?.url ?? "")

    expect(url.pathname).toBe("/api/v3.1/trigger_instances/active")
    expect(url.searchParams.get("user_ids")).toBe("user_1")
    expect(url.searchParams.get("connected_account_ids")).toBe("ca_1")
    expect(url.searchParams.get("trigger_ids")).toBe("trig_123")
    expect(url.searchParams.get("trigger_names")).toBe("GITHUB_COMMIT_EVENT")
    expect(url.searchParams.get("show_disabled")).toBe("true")
    expect(result).toMatchObject({ ok: true, items: [{ id: "trig_123", trigger_name: "GITHUB_COMMIT_EVENT" }] })
  })

  test("enables, disables, and deletes exact trigger IDs", async () => {
    const { calls, fetchImpl } = createFetch([{ status: "success" }, { status: "success" }, { trigger_id: "trig_123" }])

    await enableTrigger({ triggerId: "trig_123" }, { ...authOptions, fetchImpl })
    const disabled = await disableTrigger({ triggerId: "trig_123" }, { ...authOptions, fetchImpl })
    const deleted = await deleteTrigger({ triggerId: "trig_123" }, { ...authOptions, fetchImpl })

    expect(calls[0]).toMatchObject({
      url: "https://backend.composio.dev/api/v3.1/trigger_instances/manage/trig_123",
      init: { method: "PATCH" },
      body: { status: "enable" },
    })
    expect(calls[1]).toMatchObject({ init: { method: "PATCH" }, body: { status: "disable" } })
    expect(calls[2]).toMatchObject({ init: { method: "DELETE" }, body: undefined })
    expect(disabled.note).toContain("paused")
    expect(deleted).toMatchObject({ destructive: true, triggerId: "trig_123", status: "deleted" })
  })

  test("parses empty successful Composio responses as empty objects", async () => {
    const { fetchImpl } = createFetch([null])

    const result = await requestComposioJson(
      { path: "/api/v3.1/trigger_instances/manage/trig_123", method: "DELETE" },
      { ...authOptions, fetchImpl },
    )

    expect(result).toEqual({})
  })
})
