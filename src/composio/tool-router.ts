import { readAnonymousUserData } from "../auth/anonymous-user-data"
import { UserFacingError } from "../auth/errors"
import { redactSecrets } from "../auth/redact"
import { type ComposioClientOptions, requestComposioJson } from "./client"

const DEFAULT_USER_ID = "opencode-local"

export type ToolRouterContext = {
  sessionID?: string
}

export type ToolRouterOptions = ComposioClientOptions & {
  sessionCache?: Map<string, string>
}

export type ExecuteMetaToolInput = {
  slug: MetaToolSlug
  arguments: Record<string, unknown>
  userId?: string
  risk?: string
}

export type MetaToolSlug =
  | "COMPOSIO_SEARCH_TOOLS"
  | "COMPOSIO_GET_TOOL_SCHEMAS"
  | "COMPOSIO_MANAGE_CONNECTIONS"
  | "COMPOSIO_MULTI_EXECUTE_TOOL"
  | "COMPOSIO_REMOTE_BASH_TOOL"
  | "COMPOSIO_REMOTE_WORKBENCH"

type CreateSessionResponse = {
  session_id?: unknown
}

type ExecuteMetaResponse = {
  data?: unknown
  error?: unknown
  log_id?: unknown
}

const defaultSessionCache = new Map<string, string>()

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined
}

async function resolveUserId(explicitUserId: string | undefined, options: ToolRouterOptions): Promise<string> {
  const env = options.env ?? process.env
  const anonymousData = await readAnonymousUserData(options.home === undefined ? {} : { home: options.home })

  return (
    optionalString(explicitUserId) ??
    optionalString(env.COMPOSIO_USER_ID) ??
    optionalString(anonymousData?.composio?.member_id) ??
    optionalString(anonymousData?.slug) ??
    optionalString(anonymousData?.email) ??
    DEFAULT_USER_ID
  )
}

function sessionCacheKey(context: ToolRouterContext, userId: string): string {
  return `${context.sessionID ?? "no-opencode-session"}:${userId}`
}

async function getOrCreateToolRouterSession(
  context: ToolRouterContext,
  userId: string,
  options: ToolRouterOptions,
): Promise<string> {
  const cache = options.sessionCache ?? defaultSessionCache
  const key = sessionCacheKey(context, userId)
  const cached = cache.get(key)
  if (cached) return cached

  const response = (await requestComposioJson(
    {
      path: "/api/v3.1/tool_router/session",
      body: { user_id: userId },
    },
    options,
  )) as CreateSessionResponse
  const sessionId = optionalString(response.session_id)

  if (!sessionId) {
    throw new UserFacingError("COMPOSIO_TOOL_ROUTER_INVALID_SESSION", "Composio returned an invalid tool-router session response.", {
      body: response,
    })
  }

  cache.set(key, sessionId)
  return sessionId
}

export async function executeMetaTool(
  input: ExecuteMetaToolInput,
  context: ToolRouterContext,
  options: ToolRouterOptions = {},
): Promise<Record<string, unknown>> {
  const userId = await resolveUserId(input.userId, options)
  const toolRouterSessionId = await getOrCreateToolRouterSession(context, userId, options)
  const response = (await requestComposioJson(
    {
      path: `/api/v3.1/tool_router/session/${encodeURIComponent(toolRouterSessionId)}/execute_meta`,
      body: {
        slug: input.slug,
        arguments: input.arguments,
      },
    },
    options,
  )) as ExecuteMetaResponse
  const payload: Record<string, unknown> = {
    ok: response.error === null || response.error === undefined,
    upstreamSlug: input.slug,
    toolRouterSessionId,
    userId,
    data: response.data,
    error: response.error ?? null,
  }

  const logId = optionalString(response.log_id)
  if (logId !== undefined) payload.logId = logId
  if (input.risk !== undefined) payload.risk = input.risk

  return redactSecrets(payload) as Record<string, unknown>
}

export const __toolRouterTestUtils = {
  asRecord,
  defaultSessionCache,
  resolveUserId,
  sessionCacheKey,
}
