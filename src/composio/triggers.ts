import { type ComposioClientOptions, requestComposioJson } from "./client"

type JsonRecord = Record<string, unknown>

export type ToolkitVersions = string | Record<string, string>

export type ListTriggerTypesInput = {
  toolkitSlugs?: readonly string[]
  toolkitVersions?: ToolkitVersions
  limit?: number
  cursor?: string
}

export type GetTriggerTypeSchemaInput = {
  slug: string
  toolkitVersions?: ToolkitVersions
}

export type CreateTriggerInput = {
  slug: string
  triggerConfig: JsonRecord
  connectedAccountId?: string
  toolkitVersions?: ToolkitVersions
}

export type ListTriggersInput = {
  userIds?: readonly string[]
  connectedAccountIds?: readonly string[]
  authConfigIds?: readonly string[]
  triggerIds?: readonly string[]
  triggerNames?: readonly string[]
  showDisabled?: boolean
  limit?: number
  cursor?: string
}

export type ManageTriggerInput = {
  triggerId: string
}

export type DeleteTriggerInput = ManageTriggerInput

export type TriggerServiceOptions = ComposioClientOptions

function hasOwn(record: JsonRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key)
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined
}

function appendArray(params: URLSearchParams, key: string, values: readonly string[] | undefined): void {
  if (values === undefined) return
  for (const value of values) {
    const trimmed = value.trim()
    if (trimmed.length > 0) params.append(key, trimmed)
  }
}

function appendNumber(params: URLSearchParams, key: string, value: number | undefined): void {
  if (value !== undefined) params.set(key, String(value))
}

function appendString(params: URLSearchParams, key: string, value: string | undefined): void {
  if (value !== undefined && value.trim().length > 0) params.set(key, value.trim())
}

function appendBoolean(params: URLSearchParams, key: string, value: boolean | undefined): void {
  if (value !== undefined) params.set(key, String(value))
}

function appendToolkitVersions(params: URLSearchParams, value: ToolkitVersions | undefined): void {
  if (value === undefined) return

  if (typeof value === "string") {
    appendString(params, "toolkit_versions", value)
    return
  }

  for (const [toolkit, version] of Object.entries(value)) {
    if (toolkit.trim().length > 0 && version.trim().length > 0) {
      params.set(`toolkit_versions[${toolkit.trim()}]`, version.trim())
    }
  }
}

function withQuery(path: string, params: URLSearchParams): string {
  const query = params.toString()
  return query.length > 0 ? `${path}?${query}` : path
}

function triggerIdFrom(response: unknown): string | undefined {
  const record = asRecord(response)
  const deprecated = asRecord(record?.deprecated)

  return optionalString(record?.trigger_id) ?? optionalString(record?.triggerId) ?? optionalString(deprecated?.uuid)
}

function paginationFrom(response: unknown): JsonRecord | undefined {
  const record = asRecord(response)
  if (!record) return undefined

  const nextCursor = optionalString(record.next_cursor) ?? optionalString(record.nextCursor)
  const cursor = optionalString(record.cursor)

  if (nextCursor === undefined && cursor === undefined && !hasOwn(record, "total_pages") && !hasOwn(record, "totalPages")) {
    return undefined
  }

  const pagination: JsonRecord = {}
  if (nextCursor !== undefined) pagination.nextCursor = nextCursor
  if (cursor !== undefined) pagination.cursor = cursor
  if (hasOwn(record, "total_pages")) pagination.totalPages = record.total_pages
  if (hasOwn(record, "totalPages")) pagination.totalPages = record.totalPages
  return pagination
}

function itemsFrom(response: unknown): unknown {
  const record = asRecord(response)
  return record && hasOwn(record, "items") ? record.items : response
}

export async function listTriggerTypes(
  input: ListTriggerTypesInput,
  options: TriggerServiceOptions = {},
): Promise<JsonRecord> {
  const params = new URLSearchParams()
  appendArray(params, "toolkit_slugs", input.toolkitSlugs)
  appendToolkitVersions(params, input.toolkitVersions)
  appendNumber(params, "limit", input.limit)
  appendString(params, "cursor", input.cursor)

  const response = await requestComposioJson(
    {
      path: withQuery("/api/v3.1/triggers_types", params),
      method: "GET",
    },
    options,
  )

  const payload: JsonRecord = {
    ok: true,
    endpoint: "GET /api/v3.1/triggers_types",
    items: itemsFrom(response),
    raw: response,
  }
  const pagination = paginationFrom(response)
  if (pagination !== undefined) payload.pagination = pagination
  return payload
}

export async function getTriggerTypeSchema(
  input: GetTriggerTypeSchemaInput,
  options: TriggerServiceOptions = {},
): Promise<JsonRecord> {
  const params = new URLSearchParams()
  appendToolkitVersions(params, input.toolkitVersions)
  const response = await requestComposioJson(
    {
      path: withQuery(`/api/v3.1/triggers_types/${encodeURIComponent(input.slug)}`, params),
      method: "GET",
    },
    options,
  )
  const record = asRecord(response)

  return {
    ok: true,
    endpoint: "GET /api/v3.1/triggers_types/{slug}",
    slug: optionalString(record?.slug) ?? input.slug,
    config: record?.config ?? null,
    payload: record?.payload ?? null,
    toolkit: record?.toolkit ?? null,
    version: record?.version ?? null,
    raw: response,
  }
}

export async function createTrigger(
  input: CreateTriggerInput,
  options: TriggerServiceOptions = {},
): Promise<JsonRecord> {
  const body: JsonRecord = {
    trigger_config: input.triggerConfig,
  }
  if (input.connectedAccountId !== undefined) body.connected_account_id = input.connectedAccountId
  if (input.toolkitVersions !== undefined) body.toolkit_versions = input.toolkitVersions

  const response = await requestComposioJson(
    {
      path: `/api/v3.1/trigger_instances/${encodeURIComponent(input.slug)}/upsert`,
      body,
    },
    options,
  )
  const triggerId = triggerIdFrom(response)

  const payload: JsonRecord = {
    ok: true,
    endpoint: "POST /api/v3.1/trigger_instances/{slug}/upsert",
    operation: "upsert",
    slug: input.slug,
    status: "created_or_updated",
    connectedAccount: {
      provided: input.connectedAccountId !== undefined,
      id: input.connectedAccountId ?? null,
      requirement: "Provide connected_account_id when Composio cannot infer a connected account for this trigger's toolkit.",
    },
    raw: response,
  }
  if (triggerId !== undefined) payload.triggerId = triggerId
  return payload
}

export async function listTriggers(input: ListTriggersInput, options: TriggerServiceOptions = {}): Promise<JsonRecord> {
  const params = new URLSearchParams()
  appendArray(params, "user_ids", input.userIds)
  appendArray(params, "connected_account_ids", input.connectedAccountIds)
  appendArray(params, "auth_config_ids", input.authConfigIds)
  appendArray(params, "trigger_ids", input.triggerIds)
  appendArray(params, "trigger_names", input.triggerNames)
  appendBoolean(params, "show_disabled", input.showDisabled)
  appendNumber(params, "limit", input.limit)
  appendString(params, "cursor", input.cursor)

  const response = await requestComposioJson(
    {
      path: withQuery("/api/v3.1/trigger_instances/active", params),
      method: "GET",
    },
    options,
  )

  const payload: JsonRecord = {
    ok: true,
    endpoint: "GET /api/v3.1/trigger_instances/active",
    items: itemsFrom(response),
    raw: response,
  }
  const pagination = paginationFrom(response)
  if (pagination !== undefined) payload.pagination = pagination
  return payload
}

export async function enableTrigger(input: ManageTriggerInput, options: TriggerServiceOptions = {}): Promise<JsonRecord> {
  const response = await requestComposioJson(
    {
      path: `/api/v3.1/trigger_instances/manage/${encodeURIComponent(input.triggerId)}`,
      method: "PATCH",
      body: { status: "enable" },
    },
    options,
  )

  return {
    ok: true,
    endpoint: "PATCH /api/v3.1/trigger_instances/manage/{triggerId}",
    operation: "enable",
    triggerId: input.triggerId,
    status: "enabled",
    raw: response,
  }
}

export async function disableTrigger(input: ManageTriggerInput, options: TriggerServiceOptions = {}): Promise<JsonRecord> {
  const response = await requestComposioJson(
    {
      path: `/api/v3.1/trigger_instances/manage/${encodeURIComponent(input.triggerId)}`,
      method: "PATCH",
      body: { status: "disable" },
    },
    options,
  )

  return {
    ok: true,
    endpoint: "PATCH /api/v3.1/trigger_instances/manage/{triggerId}",
    operation: "disable",
    triggerId: input.triggerId,
    status: "disabled",
    note: "The trigger is paused, not deleted. Re-enable it with composio_enable_trigger.",
    raw: response,
  }
}

export async function deleteTrigger(input: DeleteTriggerInput, options: TriggerServiceOptions = {}): Promise<JsonRecord> {
  const response = await requestComposioJson(
    {
      path: `/api/v3.1/trigger_instances/manage/${encodeURIComponent(input.triggerId)}`,
      method: "DELETE",
    },
    options,
  )

  return {
    ok: true,
    endpoint: "DELETE /api/v3.1/trigger_instances/manage/{triggerId}",
    operation: "delete",
    triggerId: triggerIdFrom(response) ?? input.triggerId,
    status: "deleted",
    destructive: true,
    raw: response,
  }
}

export const __triggerServiceTestUtils = {
  appendToolkitVersions,
  triggerIdFrom,
  withQuery,
}
