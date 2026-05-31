import { afterEach, describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { ToolContext } from "@opencode-ai/plugin"

import { buildComposioToolRegistry } from "../../src/plugin/register-tools"

const tempHomes: string[] = []

type FetchCall = {
  url: string
  method: string
  headers: Record<string, string>
  body?: unknown
}

async function createTempHome() {
  const home = await mkdtemp(join(tmpdir(), "composio-x-opencode-runtime-"))
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

function createJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

function createRuntimeFetch(calls: FetchCall[]): typeof fetch {
  return (async (input, init) => {
    const url = String(input)
    calls.push({
      url,
      method: init?.method ?? "GET",
      headers: init?.headers as Record<string, string>,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    })

    if (url.endsWith("/tool_router/session")) {
      return createJsonResponse({ session_id: "trs_test" })
    }

    if (url.endsWith("/tool_router/session/trs_test/execute")) {
      return createJsonResponse({ data: { result: "ok" } })
    }

    if (url.includes("/triggers_types")) {
      return createJsonResponse({ items: [{ slug: "GITHUB_STAR_ADDED" }] })
    }

    return createJsonResponse({ error: { message: "unexpected endpoint" } }, 404)
  }) as typeof fetch
}

afterEach(async () => {
  await Promise.all(tempHomes.splice(0).map((home) => rm(home, { recursive: true, force: true })))
})

describe("runtime Composio tools", () => {
  test("creates a Tool Router session and executes search meta tool without leaking the API key", async () => {
    const calls: FetchCall[] = []
    const registry = buildComposioToolRegistry({
      env: { COMPOSIO_API_KEY: "ak_runtime_secret", COMPOSIO_USER_ID: "user_test" },
      home: await createTempHome(),
      apiBaseUrl: "https://api.test/v3.1",
      fetchImpl: createRuntimeFetch(calls),
    })

    const result = await registry.composio_search_tools.execute({ queries: ["hacker news"] }, createToolContext())
    const parsed = JSON.parse(typeof result === "string" ? result : result.output)

    expect(calls).toHaveLength(2)
    expect(calls[0]).toMatchObject({
      url: "https://api.test/v3.1/tool_router/session",
      method: "POST",
      headers: {
        "x-api-key": "ak_runtime_secret",
        "content-type": "application/json",
      },
      body: {
        user_id: "user_test",
      },
    })
    expect(calls[1]?.body).toMatchObject({
      tool_slug: "COMPOSIO_SEARCH_TOOLS",
      arguments: {
        queries: ["hacker news"],
        session_id: "trs_test",
      },
    })
    expect(parsed).toMatchObject({
      ok: true,
      sessionId: "trs_test",
      userId: "user_test",
      response: { data: { result: "ok" } },
    })
    expect(JSON.stringify(parsed)).not.toContain("ak_runtime_secret")
  })

  test("reuses the Tool Router session for later meta-tool calls in the same opencode session", async () => {
    const calls: FetchCall[] = []
    const registry = buildComposioToolRegistry({
      env: { COMPOSIO_API_KEY: "ak_runtime_secret", COMPOSIO_USER_ID: "user_test" },
      home: await createTempHome(),
      apiBaseUrl: "https://api.test/v3.1",
      fetchImpl: createRuntimeFetch(calls),
    })
    const context = createToolContext()

    await registry.composio_search_tools.execute({ queries: ["hacker news"] }, context)
    const result = await registry.composio_get_tool_schemas.execute({ tool_slugs: ["HACKERNEWS_GET_USER"] }, context)
    const parsed = JSON.parse(typeof result === "string" ? result : result.output)

    expect(calls.filter((call) => call.url.endsWith("/tool_router/session"))).toHaveLength(1)
    expect(calls.at(-1)?.body).toMatchObject({
      tool_slug: "COMPOSIO_GET_TOOL_SCHEMAS",
      arguments: {
        tool_slugs: ["HACKERNEWS_GET_USER"],
        session_id: "trs_test",
      },
    })
    expect(parsed.reusedSession).toBe(true)
  })

  test("uses trigger endpoints directly without creating a Tool Router session", async () => {
    const calls: FetchCall[] = []
    const registry = buildComposioToolRegistry({
      env: { COMPOSIO_API_KEY: "ak_runtime_secret", COMPOSIO_USER_ID: "user_test" },
      home: await createTempHome(),
      apiBaseUrl: "https://api.test/v3.1",
      fetchImpl: createRuntimeFetch(calls),
    })

    const result = await registry.composio_list_trigger_types.execute({ toolkit_slugs: ["github"] }, createToolContext())
    const parsed = JSON.parse(typeof result === "string" ? result : result.output)

    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe("https://api.test/v3.1/triggers_types?toolkit_slugs=github&toolkit_versions=latest")
    expect(parsed).toMatchObject({
      ok: true,
      userId: "user_test",
      response: { items: [{ slug: "GITHUB_STAR_ADDED" }] },
    })
  })
})
