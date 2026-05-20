import { describe, expect, test } from "bun:test"

import { executeMetaTool } from "../../src/composio/tool-router"

function createFetch(responses: unknown[]) {
  const calls: Array<{ url: string; body: unknown }> = []
  const fetchImpl = (async (url, init) => {
    calls.push({ url: String(url), body: init?.body === undefined ? undefined : JSON.parse(String(init.body)) })
    const response = responses.shift()
    return Response.json(response ?? {})
  }) as typeof fetch

  return { calls, fetchImpl }
}

describe("executeMetaTool", () => {
  test("creates a tool-router session and executes the requested meta tool", async () => {
    const { calls, fetchImpl } = createFetch([
      { session_id: "trs_test" },
      { data: { searched: true }, error: null, log_id: "log_test" },
    ])

    const result = await executeMetaTool(
      {
        slug: "COMPOSIO_SEARCH_TOOLS",
        arguments: { queries: [{ use_case: "create a GitHub issue" }] },
        userId: "user_explicit",
      },
      { sessionID: "opencode-session" },
      { env: { COMPOSIO_API_KEY: "ak_env_secret" }, fetchImpl, sessionCache: new Map() },
    )

    expect(result).toMatchObject({
      ok: true,
      upstreamSlug: "COMPOSIO_SEARCH_TOOLS",
      toolRouterSessionId: "trs_test",
      userId: "user_explicit",
      data: { searched: true },
      logId: "log_test",
    })
    expect(calls).toHaveLength(2)
    expect(calls[0]).toMatchObject({
      url: "https://backend.composio.dev/api/v3.1/tool_router/session",
      body: { user_id: "user_explicit" },
    })
    expect(calls[1]).toMatchObject({
      url: "https://backend.composio.dev/api/v3.1/tool_router/session/trs_test/execute_meta",
      body: {
        slug: "COMPOSIO_SEARCH_TOOLS",
        arguments: { queries: [{ use_case: "create a GitHub issue" }] },
      },
    })
  })

  test("reuses cached sessions for the same opencode session and user", async () => {
    const cache = new Map<string, string>()
    const { calls, fetchImpl } = createFetch([
      { session_id: "trs_cached" },
      { data: { first: true }, error: null, log_id: "log_1" },
      { data: { second: true }, error: null, log_id: "log_2" },
    ])
    const options = { env: { COMPOSIO_API_KEY: "ak_env_secret" }, fetchImpl, sessionCache: cache }

    await executeMetaTool(
      { slug: "COMPOSIO_GET_TOOL_SCHEMAS", arguments: { tool_slugs: ["GITHUB_CREATE_ISSUE"] }, userId: "user_1" },
      { sessionID: "same-session" },
      options,
    )
    await executeMetaTool(
      { slug: "COMPOSIO_GET_TOOL_SCHEMAS", arguments: { tool_slugs: ["GITHUB_CREATE_ISSUE"] }, userId: "user_1" },
      { sessionID: "same-session" },
      options,
    )

    expect(calls.map((call) => call.url)).toEqual([
      "https://backend.composio.dev/api/v3.1/tool_router/session",
      "https://backend.composio.dev/api/v3.1/tool_router/session/trs_cached/execute_meta",
      "https://backend.composio.dev/api/v3.1/tool_router/session/trs_cached/execute_meta",
    ])
  })
})
