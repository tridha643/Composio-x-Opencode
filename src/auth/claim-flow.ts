import { getAnonymousUserDataPath, readAnonymousUserData } from "./anonymous-user-data"
import { type FetchImpl } from "./agent-api"
import { UserFacingError } from "./errors"
import { redactSecrets, redactString } from "./redact"

const DEFAULT_AGENT_BASE_URL = "https://agents.composio.dev"
const MAX_ERROR_BODY_CHARS = 2_000

export type ClaimAnonymousIdentityOptions = {
  email: string
  home?: string
  fetchImpl?: FetchImpl
  baseUrl?: string
}

export type ClaimAnonymousIdentitySummary = {
  ok: true
  status: string
  email: string
  orgId?: string
  inviteCodePresent: boolean
  nextSteps: string[]
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

function validateEmail(email: string): string {
  const trimmed = email.trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    throw new UserFacingError("INVALID_CLAIM_EMAIL", "Provide a single valid email address for composio_claim.", {
      email: trimmed,
    })
  }
  return trimmed
}

function getPayloadEnvelope(value: unknown): unknown {
  if (!isRecord(value)) return value
  if (isRecord(value.data)) return value.data
  return value
}

function parseClaimPayload(value: unknown) {
  const payload = getPayloadEnvelope(value)
  if (!isRecord(payload)) return null

  const status = optionalString(payload.status) ?? optionalString(payload.state)
  const email = optionalString(payload.email)
  const orgId =
    optionalString(payload.org_id) ??
    optionalString(payload.orgId) ??
    optionalString(payload.organization_id) ??
    optionalString(payload.organizationId)
  const inviteCode = optionalString(payload.invite_code) ?? optionalString(payload.inviteCode)
  const inviteStatus = optionalString(payload.invite_status) ?? optionalString(payload.inviteStatus)

  if (!status && !inviteStatus && !email && !orgId && !inviteCode) return null

  return {
    status: status ?? inviteStatus ?? "invited",
    email,
    orgId,
    inviteCodePresent: Boolean(inviteCode),
  }
}

function stripSensitiveNamesAndWords(value: unknown): unknown {
  if (typeof value === "string") return value.replace(/authorization/gi, "[REDACTED]")
  if (Array.isArray(value)) return value.map((entry) => stripSensitiveNamesAndWords(entry))
  if (!isRecord(value)) return value

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !/(agent[_-]?key|api[_-]?key|user[_-]?api[_-]?key|authorization|token|secret|password)/i.test(key))
      .map(([key, entry]) => [key, stripSensitiveNamesAndWords(entry)]),
  )
}

async function safeErrorDetails(response: Response, knownSecrets: readonly string[]): Promise<unknown> {
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

  return stripSensitiveNamesAndWords(
    redactSecrets(
      {
        status: response.status,
        statusText: response.statusText,
        body,
      },
      knownSecrets,
    ),
  )
}

async function parseJsonResponse(response: Response, knownSecrets: readonly string[]): Promise<unknown> {
  try {
    return await response.json()
  } catch (error) {
    throw new UserFacingError("CLAIM_INVALID_JSON", "Composio claim returned invalid JSON.", {
      status: response.status,
      statusText: response.statusText,
      parseError: redactString(error instanceof Error ? error.message : String(error), knownSecrets),
    })
  }
}

function nextStepsFor(status: string, email: string, inviteCodePresent: boolean): string[] {
  const normalized = status.toLowerCase()
  const steps = [`Check ${email} for a Composio organization invite or claim confirmation.`]

  if (inviteCodePresent) {
    steps.push("Use the invite link/code from the email or Composio UI; this tool intentionally hides raw invite codes.")
  }

  if (["invited", "invite_sent", "pending"].includes(normalized)) {
    steps.push("Accept the invite to take ownership of the anonymous Composio organization.")
  } else if (["claimed", "complete", "completed", "accepted"].includes(normalized)) {
    steps.push("The anonymous organization appears claimed; sign in to Composio with that email to manage it.")
  } else {
    steps.push("Follow the returned Composio claim status and retry composio_claim if the invitation does not arrive.")
  }

  return steps
}

export async function claimAnonymousIdentity(
  options: ClaimAnonymousIdentityOptions,
): Promise<ClaimAnonymousIdentitySummary> {
  const email = validateEmail(options.email)
  const anonymousDataPath = getAnonymousUserDataPath(options.home)
  const anonymous = await readAnonymousUserData(options.home === undefined ? {} : { home: options.home })
  const agentKey = anonymous?.agent_key?.trim()

  if (!agentKey) {
    throw new UserFacingError(
      "MISSING_ANONYMOUS_IDENTITY",
      "No anonymous Composio agent identity was found. Run composio_signup first, then retry composio_claim.",
      { anonymousDataPath },
    )
  }

  const response = await (options.fetchImpl ?? fetch)(endpointUrl("api/claim", options.baseUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${agentKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ email }),
  })

  if (!response.ok) {
    throw new UserFacingError(
      "CLAIM_REQUEST_FAILED",
      "Composio anonymous organization claim request failed.",
      await safeErrorDetails(response, [agentKey]),
    )
  }

  const json = await parseJsonResponse(response, [agentKey])
  const payload = parseClaimPayload(json)

  if (!payload) {
    throw new UserFacingError("CLAIM_INVALID_RESPONSE", "Composio claim returned an unexpected response shape.", {
      status: response.status,
      body: redactSecrets(json, [agentKey]),
    })
  }

  const status = payload.status.toLowerCase()
  const summary: ClaimAnonymousIdentitySummary = {
    ok: true,
    status,
    email: payload.email ?? email,
    inviteCodePresent: payload.inviteCodePresent,
    nextSteps: nextStepsFor(status, payload.email ?? email, payload.inviteCodePresent),
  }
  if (payload.orgId !== undefined) summary.orgId = payload.orgId
  return summary
}
