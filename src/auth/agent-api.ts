import { type AnonymousUserData } from "./anonymous-user-data"
import { UserFacingError } from "./errors"
import { redactSecrets } from "./redact"

const DEFAULT_AGENT_BASE_URL = "https://agents.composio.dev"
const MAX_ERROR_BODY_CHARS = 2_000

export type FetchImpl = typeof fetch

export type AgentApiOptions = {
  fetchImpl?: FetchImpl
  baseUrl?: string
}

export type SignUpAgentOptions = AgentApiOptions & {
  wait?: boolean
}

type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined
}

function normalizeBaseUrl(baseUrl = DEFAULT_AGENT_BASE_URL): string {
  return baseUrl.replace(/\/+$/, "")
}

function endpointUrl(path: string, baseUrl?: string): URL {
  return new URL(path, `${normalizeBaseUrl(baseUrl)}/`)
}

function getPayloadEnvelope(value: unknown): unknown {
  if (!isRecord(value)) return value
  if (isRecord(value.data)) return value.data
  if (isRecord(value.agent)) return value.agent
  return value
}

function parseAnonymousUserDataShape(value: unknown): AnonymousUserData | null {
  const payload = getPayloadEnvelope(value)
  if (!isRecord(payload)) return null

  const composioValue = payload.composio
  if (composioValue !== undefined && !isRecord(composioValue)) return null

  const data: AnonymousUserData = {}

  const status = optionalString(payload.status)
  const requestId = optionalString(payload.request_id) ?? optionalString(payload.requestId)
  const slug = optionalString(payload.slug)
  const email = optionalString(payload.email)
  const agentKey = optionalString(payload.agent_key) ?? optionalString(payload.agentKey)

  if (status !== undefined) data.status = status
  if (requestId !== undefined) data.request_id = requestId
  if (slug !== undefined) data.slug = slug
  if (email !== undefined) data.email = email
  if (agentKey !== undefined) data.agent_key = agentKey

  if (isRecord(composioValue)) {
    const composio: NonNullable<AnonymousUserData["composio"]> = {}
    const memberId = optionalString(composioValue.member_id) ?? optionalString(composioValue.memberId)
    const orgId = optionalString(composioValue.org_id) ?? optionalString(composioValue.orgId)
    const projectId = optionalString(composioValue.project_id) ?? optionalString(composioValue.projectId)
    const apiKey = optionalString(composioValue.api_key) ?? optionalString(composioValue.apiKey)
    const userApiKey = optionalString(composioValue.user_api_key) ?? optionalString(composioValue.userApiKey)

    if (memberId !== undefined) composio.member_id = memberId
    if (orgId !== undefined) composio.org_id = orgId
    if (projectId !== undefined) composio.project_id = projectId
    if (apiKey !== undefined) composio.api_key = apiKey
    if (userApiKey !== undefined) composio.user_api_key = userApiKey
    data.composio = composio
  }

  if (!data.status && !data.agent_key && !data.composio) return null
  return data
}

function isReadyStatus(status: string | undefined): boolean {
  return status?.toLowerCase() === "ready"
}

async function parseJsonResponse(response: Response, code: string, message: string): Promise<unknown> {
  try {
    return await response.json()
  } catch (error) {
    throw new UserFacingError(code, message, {
      status: response.status,
      statusText: response.statusText,
      parseError: error instanceof Error ? error.message : String(error),
    })
  }
}

async function safeErrorDetails(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? ""
  let body: unknown

  try {
    if (contentType.toLowerCase().includes("json")) {
      body = await response.json()
    } else {
      body = (await response.text()).slice(0, MAX_ERROR_BODY_CHARS)
    }
  } catch (error) {
    body = { parseError: error instanceof Error ? error.message : String(error) }
  }

  return redactSecrets({
    status: response.status,
    statusText: response.statusText,
    body,
  })
}

async function assertOk(response: Response, code: string, message: string): Promise<void> {
  if (response.status === 202) {
    throw new UserFacingError("AGENT_SIGNUP_PENDING", "Composio agent signup is pending; retry shortly.", await safeErrorDetails(response))
  }

  if (!response.ok) {
    throw new UserFacingError(code, message, await safeErrorDetails(response))
  }
}

export async function signUpAgent(options: SignUpAgentOptions = {}): Promise<AnonymousUserData> {
  const url = endpointUrl("api/signup", options.baseUrl)
  if (options.wait === false) url.searchParams.set("wait", "0")

  const response = await (options.fetchImpl ?? fetch)(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  })

  await assertOk(response, "AGENT_SIGNUP_FAILED", "Composio agent signup failed.")

  const json = await parseJsonResponse(
    response,
    "AGENT_SIGNUP_INVALID_JSON",
    "Composio agent signup returned invalid JSON.",
  )
  const data = parseAnonymousUserDataShape(json)

  if (!data || !isReadyStatus(data.status) || !data.agent_key || !data.composio?.api_key) {
    throw new UserFacingError("AGENT_SIGNUP_INVALID_RESPONSE", "Composio agent signup returned an unexpected response shape.", {
      status: response.status,
      body: redactSecrets(json),
    })
  }

  return data
}

export async function whoAmI(agentKey: string, options: AgentApiOptions = {}): Promise<AnonymousUserData> {
  const url = endpointUrl("api/whoami", options.baseUrl)
  const response = await (options.fetchImpl ?? fetch)(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${agentKey}` },
  })

  await assertOk(response, "AGENT_WHOAMI_FAILED", "Composio agent identity verification failed.")

  const json = await parseJsonResponse(
    response,
    "AGENT_WHOAMI_INVALID_JSON",
    "Composio agent identity verification returned invalid JSON.",
  )
  const data = parseAnonymousUserDataShape(json)

  if (!data || !isReadyStatus(data.status)) {
    throw new UserFacingError("AGENT_WHOAMI_INVALID_RESPONSE", "Composio agent identity verification returned an unexpected response shape.", {
      status: response.status,
      body: redactSecrets(json),
    })
  }

  return data
}

export const __agentApiTestUtils = {
  isReadyStatus,
}
