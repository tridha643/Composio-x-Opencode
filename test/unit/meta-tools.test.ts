import { describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import {
  createGetToolSchemasTool,
  createManageConnectionsTool,
  createMultiExecuteTool,
  createRemoteBashTool,
  createRemoteWorkbenchTool,
  createSearchToolsTool,
} from "../../src/tools/meta"

function createToolContext(sessionID = "test-session") {
  return {
    sessionID,
    messageID: "test-message",
    agent: "test-agent",
    directory: process.cwd(),
    worktree: process.cwd(),
    abort: new AbortController().signal,
    metadata() {},
    ask: (() => {}) as never,
  }
}

function createFetch() {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = []
  const fetchImpl = (async (url, init) => {
    const body = init?.body === undefined ? {} : (JSON.parse(String(init.body)) as Record<string, unknown>)
    calls.push({ url: String(url), body })

    if (String(url).endsWith("/tool_router/session")) {
      return Response.json({ session_id: "trs_test" })
    }

    return Response.json({ data: { echoed: body }, error: null, log_id: "log_test" })
  }) as typeof fetch

  return { calls, fetchImpl }
}

function createFetchResponses(responses: unknown[]) {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = []
  const fetchImpl = (async (url, init) => {
    const body = init?.body === undefined ? {} : (JSON.parse(String(init.body)) as Record<string, unknown>)
    calls.push({ url: String(url), body })

    return Response.json(responses.shift() ?? {})
  }) as typeof fetch

  return { calls, fetchImpl }
}

function outputOf(result: Awaited<ReturnType<ReturnType<typeof createSearchToolsTool>["execute"]>>) {
  return typeof result === "string" ? result : result.output
}

function metadataOf(result: Awaited<ReturnType<ReturnType<typeof createSearchToolsTool>["execute"]>>) {
  return (typeof result === "string" ? JSON.parse(result) : result.metadata) as Record<string, unknown>
}

function expectNoSecretValues(value: unknown) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value)
  expect(serialized).not.toContain("ak_env_secret")
  expect(serialized).not.toContain("Bearer ak_env_secret")
  expect(serialized).not.toContain("composio_agent_key_secret")
}

describe("Phase 3 meta tools", () => {
  test("maps each opencode tool to the correct upstream meta slug", async () => {
    const cases = [
      {
        tool: createSearchToolsTool,
        args: { queries: [{ use_case: "send an email", known_fields: "recipient:test@example.com" }] },
        slug: "COMPOSIO_SEARCH_TOOLS",
      },
      {
        tool: createGetToolSchemasTool,
        args: { tool_slugs: ["GMAIL_SEND_EMAIL"], include: ["input_schema", "output_schema"], session_id: "workflow_1" },
        slug: "COMPOSIO_GET_TOOL_SCHEMAS",
      },
      {
        tool: createManageConnectionsTool,
        args: { toolkits: ["gmail"], reinitiate_all: true, session_id: "workflow_1" },
        slug: "COMPOSIO_MANAGE_CONNECTIONS",
        risk: "auth_state_change",
      },
      {
        tool: createMultiExecuteTool,
        args: {
          tools: [{ tool_slug: "GMAIL_SEND_EMAIL", arguments: { to: "test@example.com" } }],
          sync_response_to_workbench: false,
          current_step: "SENDING_EMAIL",
        },
        slug: "COMPOSIO_MULTI_EXECUTE_TOOL",
        risk: "open_world_external_mutation",
      },
      {
        tool: createRemoteBashTool,
        args: { command: "pwd", session_id: "workflow_1" },
        slug: "COMPOSIO_REMOTE_BASH_TOOL",
        risk: "remote_code_execution",
      },
      {
        tool: createRemoteWorkbenchTool,
        args: { code_to_execute: "print('hi')", thought: "test" },
        slug: "COMPOSIO_REMOTE_WORKBENCH",
        risk: "remote_code_execution",
      },
    ] as const

    for (const entry of cases) {
      const { calls, fetchImpl } = createFetch()
      const tool = entry.tool({ env: { COMPOSIO_API_KEY: "ak_env_secret" }, fetchImpl, sessionCache: new Map() })
      const result = await tool.execute(entry.args as never, createToolContext())
      const parsed = JSON.parse(outputOf(result))
      const executeBody = calls[1]?.body

      expect(parsed.ok).toBe(true)
      expect(parsed.upstreamSlug).toBe(entry.slug)
      if ("risk" in entry) expect(parsed.risk).toBe(entry.risk)
      expect(executeBody?.slug).toBe(entry.slug)
      expect(executeBody?.arguments).toMatchObject(entry.args)
      expectNoSecretValues(parsed)
    }
  })

  test("returns missing-auth guidance instead of throwing", async () => {
    const home = await mkdtemp(join(tmpdir(), "meta-tools-missing-auth-"))
    const tool = createSearchToolsTool({
      env: {},
      home,
      fetchImpl: (async () => Response.json({})) as unknown as typeof fetch,
    })
    const result = await tool.execute({ queries: [{ use_case: "send an email" }] }, createToolContext())
    const parsed = JSON.parse(outputOf(result))

    await rm(home, { recursive: true, force: true })

    expect(parsed.ok).toBe(false)
    expect(parsed.code).toBe("MISSING_COMPOSIO_CREDENTIALS")
    expect(parsed.message).toContain("composio_signup")
  })

  test("renders manage-connections redirect_url as a clickable connection link", async () => {
    const { fetchImpl } = createFetchResponses([
      { session_id: "trs_test" },
      {
        data: {
          toolkits: [
            {
              toolkit: "slack",
              status: "not_connected",
              connection_request: {
                redirect_url: "https://app.composio.dev/connect/slack?request=req_test",
              },
            },
          ],
        },
        error: null,
        log_id: "log_test",
      },
    ])
    const tool = createManageConnectionsTool({ env: { COMPOSIO_API_KEY: "ak_env_secret" }, fetchImpl, sessionCache: new Map() })
    const result = await tool.execute({ toolkits: ["slack"] }, createToolContext())
    const output = outputOf(result)
    const metadata = metadataOf(result)

    expect(output).toContain("## Connect Slack")
    expect(output).toContain("[Connect Slack](https://app.composio.dev/connect/slack?request=req_test)")
    expect(metadata).toMatchObject({
      ok: false,
      upstreamOk: true,
      code: "COMPOSIO_CONNECTION_REQUIRED",
      connectionRequired: true,
      toolkits: ["slack"],
    })
    expect(metadata.connectionLinks).toEqual([
      {
        toolkit: "slack",
        url: "https://app.composio.dev/connect/slack?request=req_test",
        source: "redirect_url",
      },
    ])
    expectNoSecretValues(metadata)
  })

  test("supports camelCase redirectUrl connection links", async () => {
    const { fetchImpl } = createFetchResponses([
      { session_id: "trs_test" },
      {
        data: {
          toolkit: "gmail",
          redirectUrl: "https://app.composio.dev/connect/gmail?request=req_test",
        },
        error: null,
      },
    ])
    const tool = createManageConnectionsTool({ env: { COMPOSIO_API_KEY: "ak_env_secret" }, fetchImpl, sessionCache: new Map() })
    const result = await tool.execute({ toolkits: ["gmail"] }, createToolContext())
    const output = outputOf(result)
    const metadata = metadataOf(result)

    expect(output).toContain("[Connect Gmail](https://app.composio.dev/connect/gmail?request=req_test)")
    expect(metadata.connectionLinks).toEqual([
      {
        toolkit: "gmail",
        url: "https://app.composio.dev/connect/gmail?request=req_test",
        source: "redirectUrl",
      },
    ])
  })

  test("guides multi-execute failures to manage connections when no link is returned", async () => {
    const { fetchImpl } = createFetchResponses([
      { session_id: "trs_test" },
      {
        data: null,
        error: {
          message: "No active connection found for toolkit Slack. Connect account before executing this tool.",
        },
        log_id: "log_test",
      },
    ])
    const tool = createMultiExecuteTool({ env: { COMPOSIO_API_KEY: "ak_env_secret" }, fetchImpl, sessionCache: new Map() })
    const result = await tool.execute(
      { tools: [{ tool_slug: "SLACK_SEND_MESSAGE", arguments: { channel: "C123", text: "hi" } }] },
      createToolContext(),
    )
    const output = outputOf(result)
    const metadata = metadataOf(result)

    expect(output).toContain("## Connect Slack")
    expect(output).toContain("No connection link was returned yet")
    expect(output).toContain("composio_manage_connections")
    expect(metadata).toMatchObject({
      ok: false,
      code: "COMPOSIO_CONNECTION_REQUIRED",
      connectionRequired: true,
      toolkits: ["slack"],
      connectionLinks: [],
    })
    expect(JSON.stringify(metadata.nextSteps)).toContain("composio_manage_connections")
  })

  test("descriptions mark risky remote and auth behaviors clearly", () => {
    expect(createManageConnectionsTool().description).toMatch(/auth|OAuth|connection/i)
    expect(createMultiExecuteTool().description).toMatch(/mutate|external|third-party/i)
    expect(createRemoteBashTool().description).toMatch(/remote|not the local/i)
    expect(createRemoteWorkbenchTool().description).toMatch(/remote|not locally/i)
  })
})
