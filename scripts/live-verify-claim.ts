/**
 * Live verification: anonymous signup + POST /api/claim against agents.composio.dev.
 *
 * This script intentionally uses an isolated temporary HOME, prints only field presence
 * for sensitive response values, and POSTs /api/claim exactly once.
 *
 * Usage:
 *   bun scripts/live-verify-claim.ts --email you@example.com
 *   CLAIM_VERIFICATION_EMAIL=you@example.com bun scripts/live-verify-claim.ts
 *
 * Optional:
 *   --base-url https://agents.composio.dev
 *   --keep-home
 *   --json /tmp/composio-claim-report.json
 *
 * If --email/env is omitted, a time-based @mailinator.com address is used for
 * manual inbox verification at https://www.mailinator.com/.
 */
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { ensureAnonymousIdentity } from "../src/auth/signup-flow"

const DEFAULT_BASE_URL = "https://agents.composio.dev"
const MAX_BODY_PREVIEW_CHARS = 2_000

type JsonRecord = Record<string, unknown>

type CliOptions = {
  email: string | undefined
  baseUrl: string
  keepHome: boolean
  jsonPath: string | undefined
  help: boolean
}

type ClaimContract = "docs_invite_code" | "live_claim_slug" | "both" | "unknown"

type ClaimShape = {
  topLevelKeys: string[]
  dataKeys: string[]
  status: string | undefined
  email: string | undefined
  orgIdPresent: boolean
  inviteCodePresent: boolean
  claimSlugPresent: boolean
  expiresAtPresent: boolean
  contract: ClaimContract
}

type ResponseBodyPreview = {
  contentType: string
  kind: "json" | "text" | "empty" | "unreadable"
  json: unknown | undefined
  textPreview: string | undefined
  parseError: string | undefined
}

type VerificationReport = {
  baseUrl: string
  tempHome: string
  tempHomeRemoved: boolean
  requestedEmail: string
  signup: unknown
  claim: {
    httpStatus: number
    httpStatusText: string
    ok: boolean
    shape: ClaimShape
    responseBody: ResponseBodyPreview
    pluginStyleSummary?: Record<string, unknown>
  }
  verdict: string[]
  manualEmailCheck: string[]
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function payloadEnvelope(value: unknown): JsonRecord {
  if (!isRecord(value)) return {}
  return isRecord(value.data) ? value.data : value
}

function keysFor(value: unknown): string[] {
  return isRecord(value) ? Object.keys(value).sort() : []
}

function stringValue(record: JsonRecord, names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = record[name]
    if (typeof value === "string") return value
  }
  return undefined
}

function stringPresent(record: JsonRecord, names: readonly string[]): boolean {
  return stringValue(record, names) !== undefined
}

function parseArgs(argv: readonly string[]): CliOptions {
  const options: CliOptions = {
    email: process.env.CLAIM_VERIFICATION_EMAIL?.trim() || undefined,
    baseUrl: process.env.COMPOSIO_AGENT_BASE_URL?.trim() || DEFAULT_BASE_URL,
    keepHome: process.env.CLAIM_VERIFICATION_KEEP_HOME === "1",
    jsonPath: process.env.CLAIM_VERIFICATION_JSON?.trim() || undefined,
    help: false,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === "--help" || arg === "-h") {
      options.help = true
    } else if (arg === "--keep-home") {
      options.keepHome = true
    } else if (arg === "--email") {
      const value = argv[i + 1]?.trim()
      if (!value) throw new Error("--email requires a value")
      options.email = value
      i += 1
    } else if (arg === "--base-url") {
      const value = argv[i + 1]?.trim()
      if (!value) throw new Error("--base-url requires a value")
      options.baseUrl = value
      i += 1
    } else if (arg === "--json") {
      const value = argv[i + 1]?.trim()
      if (!value) throw new Error("--json requires a value")
      options.jsonPath = value
      i += 1
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  return options
}

function printHelp(): void {
  console.log(`Live Composio claim verifier\n\nUsage:\n  bun scripts/live-verify-claim.ts [--email you@example.com] [--base-url URL] [--keep-home] [--json path]\n\nEnvironment equivalents:\n  CLAIM_VERIFICATION_EMAIL=you@example.com\n  COMPOSIO_AGENT_BASE_URL=https://agents.composio.dev\n  CLAIM_VERIFICATION_KEEP_HOME=1\n  CLAIM_VERIFICATION_JSON=/tmp/report.json\n`)
}

function defaultEmail(): string {
  return `composio-claim-${Date.now()}@mailinator.com`
}

function classifyContract(inviteCodePresent: boolean, claimSlugPresent: boolean): ClaimContract {
  if (inviteCodePresent && claimSlugPresent) return "both"
  if (inviteCodePresent) return "docs_invite_code"
  if (claimSlugPresent) return "live_claim_slug"
  return "unknown"
}

async function readResponseBody(response: Response): Promise<ResponseBodyPreview> {
  const contentType = response.headers.get("content-type") ?? ""

  try {
    if (contentType.toLowerCase().includes("json")) {
      return {
        contentType,
        kind: "json",
        json: await response.json(),
        textPreview: undefined,
        parseError: undefined,
      }
    }

    const text = await response.text()
    return {
      contentType,
      kind: text.length === 0 ? "empty" : "text",
      json: undefined,
      textPreview: text.slice(0, MAX_BODY_PREVIEW_CHARS),
      parseError: undefined,
    }
  } catch (error) {
    return {
      contentType,
      kind: "unreadable",
      json: undefined,
      textPreview: undefined,
      parseError: error instanceof Error ? error.message : String(error),
    }
  }
}

function safeClaimShape(body: unknown): ClaimShape {
  const inner = payloadEnvelope(body)
  const inviteCodePresent = stringPresent(inner, ["invite_code", "inviteCode"])
  const claimSlugPresent = stringPresent(inner, ["claim_slug", "claimSlug"])

  return {
    topLevelKeys: keysFor(body),
    dataKeys: isRecord(body) ? keysFor(body.data) : [],
    status: stringValue(inner, ["status", "state", "invite_status", "inviteStatus"]),
    email: stringValue(inner, ["email"]),
    orgIdPresent: stringPresent(inner, ["org_id", "orgId", "organization_id", "organizationId"]),
    inviteCodePresent,
    claimSlugPresent,
    expiresAtPresent: stringPresent(inner, ["expires_at", "expiresAt"]),
    contract: classifyContract(inviteCodePresent, claimSlugPresent),
  }
}

function redactedReportValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => redactedReportValue(entry))
  if (!isRecord(value)) return value

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      if (/(agent[_-]?key|api[_-]?key|user[_-]?api[_-]?key|authorization|token|secret|password|invite[_-]?code|claim[_-]?slug)/i.test(key)) {
        return [key, "[REDACTED]"]
      }
      return [key, redactedReportValue(entry)]
    }),
  )
}

function redactedResponseBodyPreview(preview: ResponseBodyPreview): ResponseBodyPreview {
  return {
    ...preview,
    json: preview.json === undefined ? undefined : redactedReportValue(preview.json),
    textPreview: preview.textPreview?.replace(/(claim[_-]?slug|invite[_-]?code|agent[_-]?key|api[_-]?key|token|secret)([^\n,}]*)/gi, "$1=[REDACTED]"),
  }
}

/** Mirrors claim-flow parsing so we only POST /api/claim once. */
function pluginStyleClaimSummary(rawJson: unknown, requestedEmail: string): Record<string, unknown> {
  const inner = payloadEnvelope(rawJson)

  const statusRaw = stringValue(inner, ["status", "state", "invite_status", "inviteStatus"]) ?? "invited"
  const email = stringValue(inner, ["email"]) ?? requestedEmail
  const orgId = stringValue(inner, ["org_id", "orgId", "organization_id", "organizationId"])
  const inviteCodePresent = stringPresent(inner, ["invite_code", "inviteCode"])
  const claimSlugPresent = stringPresent(inner, ["claim_slug", "claimSlug"])
  const expiresAt = stringValue(inner, ["expires_at", "expiresAt"])

  const status = statusRaw.toLowerCase()
  const nextSteps = [`Check ${email} for a Composio organization invite or claim confirmation.`]
  if (expiresAt) {
    nextSteps.push(`This claim handoff expires at ${expiresAt} according to Composio.`)
  }
  if (inviteCodePresent) {
    nextSteps.push("Use the invite link/code from the email or Composio UI; this tool intentionally hides raw invite codes.")
  } else if (claimSlugPresent) {
    nextSteps.push(
      "Composio returned a claim_slug handoff token (hidden here). If email does not arrive, sign into Composio or check spam folders before retrying.",
    )
  }
  if (["invited", "invite_sent", "pending"].includes(status)) {
    nextSteps.push("Accept the invite to take ownership of the anonymous Composio organization.")
  } else if (["claimed", "complete", "completed", "accepted"].includes(status)) {
    nextSteps.push("The anonymous organization appears claimed; sign in to Composio with that email to manage it.")
  } else {
    nextSteps.push("Follow the returned Composio claim status and retry composio_claim if the invitation does not arrive.")
  }

  const summary: Record<string, unknown> = {
    ok: true,
    status,
    email,
    inviteCodePresent,
    claimSlugPresent,
    nextSteps,
  }
  if (orgId !== undefined) summary.orgId = orgId
  if (expiresAt !== undefined) summary.expiresAt = expiresAt
  return summary
}

function buildVerdict(httpOk: boolean, httpStatus: number, shape: ClaimShape): string[] {
  const verdict: string[] = []

  if (!httpOk) {
    verdict.push("FAIL: /api/claim did not return a 2xx HTTP response.")
    if (httpStatus === 502) {
      verdict.push("UPSTREAM: Cloudflare returned 502 Bad Gateway; agents.composio.dev host is failing behind Cloudflare. Retry later or report the Ray ID/time to Composio.")
    } else if (httpStatus >= 500) {
      verdict.push("UPSTREAM: Composio agent service returned a 5xx server error.")
    }
    return verdict
  }

  verdict.push("PASS: /api/claim returned a 2xx HTTP response.")

  if (shape.status?.toLowerCase() === "invited") {
    verdict.push('PASS: response status is "invited".')
  } else {
    verdict.push(`WARN: response status is ${shape.status === undefined ? "missing" : JSON.stringify(shape.status)}.`)
  }

  if (shape.contract === "live_claim_slug") {
    verdict.push("OBSERVED: live API contract uses claim_slug/expires_at style fields, not docs invite_code.")
  } else if (shape.contract === "docs_invite_code") {
    verdict.push("OBSERVED: API contract matches docs-style invite_code response.")
  } else if (shape.contract === "both") {
    verdict.push("OBSERVED: API returned both invite_code and claim_slug fields.")
  } else {
    verdict.push("WARN: response contained neither invite_code nor claim_slug string fields.")
  }

  if (shape.expiresAtPresent) {
    verdict.push("OBSERVED: response includes an expiry timestamp for the claim handoff.")
  }

  verdict.push("NOTE: API success does not prove email delivery; check the target inbox/spam manually.")
  return verdict
}

function manualEmailCheck(email: string): string[] {
  const steps = [`Check ${email} for a Composio organization invite or claim confirmation.`]
  const [localPart, domain] = email.split("@")
  if (localPart && domain?.toLowerCase() === "mailinator.com") {
    steps.push(`Mailinator shortcut: open https://www.mailinator.com/ and enter inbox "${localPart}".`)
  }
  steps.push("If no email arrives, capture this script's report and ask Composio whether claim_slug implies automatic email delivery or a separate claim-link flow.")
  return steps
}

async function readAgentKey(home: string): Promise<string> {
  const path = join(home, ".composio", "anonymous_user_data.json")
  const persisted = JSON.parse(await readFile(path, "utf8")) as { agent_key?: unknown }
  const agentKey = typeof persisted.agent_key === "string" ? persisted.agent_key.trim() : ""
  if (!agentKey) throw new Error("missing agent_key after signup")
  return agentKey
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }

  const email = options.email ?? defaultEmail()
  const home = await mkdtemp(join(tmpdir(), "composio-live-verify-claim-"))
  let tempHomeRemoved = false

  try {
    console.log(`Temp HOME: ${home}`)
    console.log(`Base URL: ${options.baseUrl}`)
    console.log(`Claim email: ${email}`)

    const signup = await ensureAnonymousIdentity({ home, baseUrl: options.baseUrl })
    console.log("\nSignup summary (secret-free):")
    console.log(JSON.stringify(signup, null, 2))

    const agentKey = await readAgentKey(home)
    const claimUrl = new URL("api/claim", `${options.baseUrl.replace(/\/+$/, "")}/`)
    const rawResponse = await fetch(claimUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${agentKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ email }),
    })

    const responseBody = await readResponseBody(rawResponse)
    const rawJson: unknown = responseBody.kind === "json" ? responseBody.json : null
    const shape = safeClaimShape(rawJson)
    const claim: VerificationReport["claim"] = {
      httpStatus: rawResponse.status,
      httpStatusText: rawResponse.statusText,
      ok: rawResponse.ok,
      shape,
      responseBody: redactedResponseBodyPreview(responseBody),
    }
    if (rawResponse.ok) claim.pluginStyleSummary = pluginStyleClaimSummary(rawJson, email)
    const report: VerificationReport = {
      baseUrl: options.baseUrl,
      tempHome: home,
      tempHomeRemoved: false,
      requestedEmail: email,
      signup,
      claim,
      verdict: buildVerdict(rawResponse.ok, rawResponse.status, shape),
      manualEmailCheck: manualEmailCheck(email),
    }

    console.log("\nPOST /api/claim (single request; sensitive values hidden):")
    console.log(`  HTTP ${rawResponse.status} ${rawResponse.statusText}`)
    console.log(`  Content-Type: ${responseBody.contentType || "(missing)"}`)
    console.log(JSON.stringify(shape, null, 2))
    if (responseBody.kind !== "json") {
      console.log("\nNon-JSON response preview:")
      console.log(responseBody.textPreview ?? responseBody.parseError ?? "(empty)")
    }

    if (claim.pluginStyleSummary) {
      console.log("\nEquivalent composio_claim tool summary (from same JSON; no second HTTP call):")
      console.log(JSON.stringify(claim.pluginStyleSummary, null, 2))
    }

    console.log("\nVerdict:")
    for (const line of report.verdict) console.log(`- ${line}`)

    console.log("\nManual email check:")
    for (const line of report.manualEmailCheck) console.log(`- ${line}`)

    if (options.jsonPath) {
      await writeFile(options.jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8")
      console.log(`\nWrote redacted report: ${options.jsonPath}`)
    }

    if (!rawResponse.ok) process.exitCode = 1
  } finally {
    if (options.keepHome) {
      console.log(`\nKeeping temp HOME for inspection: ${home}`)
    } else {
      await rm(home, { recursive: true, force: true })
      tempHomeRemoved = true
      console.log(`\nRemoved temp HOME: ${home}`)
    }
    void tempHomeRemoved
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
