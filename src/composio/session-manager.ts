import { createHash } from "node:crypto"
import { type ToolContext } from "@opencode-ai/plugin"

import { readAnonymousUserData } from "../auth/anonymous-user-data"
import { type FetchImpl } from "../auth/agent-api"
import { UserFacingError } from "../auth/errors"
import { getMissingCredentialMessage, resolveComposioAuth } from "../auth/resolve-auth"
import { ComposioApiClient } from "./client"
import { getComposioApiBaseUrl } from "./config"

export type RuntimeSessionArgs = {
  session_id?: string
  user_id?: string
  toolkits?: string[]
  toolkit_versions?: string | Record<string, unknown>
  auth_configs?: Record<string, string>
  connected_accounts?: Record<string, string[]>
}

export type RuntimeSession = {
  client: ComposioApiClient
  sessionId: string
  userId: string
  authSource: "env" | "anonymous"
  reused: boolean
}

export type AuthenticatedComposioRuntime = {
  client: ComposioApiClient
  userId: string
  authSource: "env" | "anonymous"
}

export type ComposioSessionManagerOptions = {
  env?: Record<string, string | undefined>
  home?: string
  fetchImpl?: FetchImpl
  apiBaseUrl?: string
}

type CachedSession = {
  sessionId: string
  userId: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function parseSessionId(value: unknown): string | null {
  if (!isRecord(value)) return null
  const direct = optionalString(value.session_id) ?? optionalString(value.sessionId)
  if (direct) return direct

  if (isRecord(value.data)) {
    return optionalString(value.data.session_id) ?? optionalString(value.data.sessionId) ?? null
  }

  return null
}

function stableHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16)
}

function opencodeSessionKey(context: ToolContext | undefined): string {
  return context?.sessionID || "global"
}

function buildSessionBody(userId: string, args: RuntimeSessionArgs): Record<string, unknown> {
  const body: Record<string, unknown> = {
    user_id: userId,
    manage_connections: {
      enable: true,
      wait_for_connections: false,
      enable_connection_removal: true,
    },
    workbench: {
      enable: true,
      enable_proxy_execution: true,
    },
    execute: {
      enable_multi_execute: true,
    },
    search: {
      enable: true,
    },
  }

  if (args.toolkits !== undefined) body.toolkits = { enabled: args.toolkits }
  if (args.auth_configs !== undefined) body.auth_configs = args.auth_configs
  if (args.connected_accounts !== undefined) body.connected_accounts = args.connected_accounts
  if (args.toolkit_versions !== undefined) body.toolkit_versions = args.toolkit_versions

  return body
}

export class ComposioSessionManager {
  private readonly options: ComposioSessionManagerOptions
  private readonly cache = new Map<string, CachedSession>()

  constructor(options: ComposioSessionManagerOptions = {}) {
    this.options = options
  }

  async getAuthenticatedRuntime(args: Pick<RuntimeSessionArgs, "user_id"> = {}, context?: ToolContext): Promise<AuthenticatedComposioRuntime> {
    const authOptions: Parameters<typeof resolveComposioAuth>[0] = {}
    if (this.options.env !== undefined) authOptions.env = this.options.env
    if (this.options.home !== undefined) authOptions.home = this.options.home
    const auth = await resolveComposioAuth(authOptions)
    if (!auth.apiKey || auth.source === null) {
      throw new UserFacingError("MISSING_COMPOSIO_CREDENTIALS", getMissingCredentialMessage(), {
        anonymousDataPath: auth.anonymousPath,
      })
    }

    const clientOptions: ConstructorParameters<typeof ComposioApiClient>[0] = {
      apiKey: auth.apiKey,
      baseUrl: this.options.apiBaseUrl ?? getComposioApiBaseUrl(this.options.env),
    }
    if (this.options.fetchImpl !== undefined) clientOptions.fetchImpl = this.options.fetchImpl
    const client = new ComposioApiClient(clientOptions)

    const anonymous = await readAnonymousUserData(this.options.home === undefined ? {} : { home: this.options.home })
    const userId =
      args.user_id?.trim() ||
      this.options.env?.COMPOSIO_USER_ID?.trim() ||
      process.env.COMPOSIO_USER_ID?.trim() ||
      anonymous?.slug ||
      anonymous?.composio?.member_id ||
      `opencode-${opencodeSessionKey(context)}`

    return {
      client,
      userId,
      authSource: auth.source,
    }
  }

  async getRuntimeSession(args: RuntimeSessionArgs, context?: ToolContext): Promise<RuntimeSession> {
    const runtime = await this.getAuthenticatedRuntime(args, context)
    const { client, userId, authSource } = runtime

    if (args.session_id?.trim()) {
      return {
        client,
        sessionId: args.session_id.trim(),
        userId,
        authSource,
        reused: true,
      }
    }

    const cacheKey = stableHash({
      opencodeSession: opencodeSessionKey(context),
      userId,
      toolkits: args.toolkits,
      toolkitVersions: args.toolkit_versions,
      authConfigs: args.auth_configs,
      connectedAccounts: args.connected_accounts,
    })
    const cached = this.cache.get(cacheKey)
    if (cached) {
      return {
        client,
        sessionId: cached.sessionId,
        userId: cached.userId,
        authSource,
        reused: true,
      }
    }

    const requestOptions: Parameters<ComposioApiClient["request"]>[2] = {
      body: buildSessionBody(userId, args),
    }
    if (context?.abort !== undefined) requestOptions.signal = context.abort
    const response = await client.request("POST", "tool_router/session", requestOptions)
    const sessionId = parseSessionId(response)

    if (!sessionId) {
      throw new UserFacingError("COMPOSIO_SESSION_INVALID_RESPONSE", "Composio Tool Router did not return a session_id.", {
        response,
      })
    }

    this.cache.set(cacheKey, { sessionId, userId })

    return {
      client,
      sessionId,
      userId,
      authSource,
      reused: false,
    }
  }
}
