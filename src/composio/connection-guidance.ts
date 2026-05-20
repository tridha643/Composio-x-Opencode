const URL_KEYS = new Set(["redirect_url", "redirectUrl", "url", "link"])
const TOOLKIT_KEYS = ["toolkit", "toolkit_slug", "toolkitSlug", "appName", "app_name"] as const

export type ConnectionLink = {
  toolkit?: string
  url: string
  source: string
}

export type ConnectionGuidance = {
  ok: false
  code: "COMPOSIO_CONNECTION_REQUIRED"
  connectionRequired: true
  toolkits: string[]
  connectionLinks: ConnectionLink[]
  nextSteps: string[]
}

type ConnectionGuidanceOptions = {
  requestedToolkits?: readonly string[]
  toolSlugs?: readonly string[]
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

function titleCase(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function inferToolkitFromToolSlug(slug: string): string | undefined {
  const prefix = slug.split("_")[0]?.trim().toLowerCase()
  return prefix && prefix !== "composio" ? prefix : undefined
}

function addUnique(values: Set<string>, value: string | undefined): void {
  if (value !== undefined) values.add(value)
}

function toolkitFromRecord(record: Record<string, unknown>): string | undefined {
  for (const key of TOOLKIT_KEYS) {
    const value = optionalString(record[key])
    if (value !== undefined) return value.toLowerCase()
  }
  return undefined
}

function collectConnectionSignals(
  value: unknown,
  links: ConnectionLink[],
  toolkits: Set<string>,
  state: { missingConnection: boolean },
  inheritedToolkit?: string,
): void {
  if (typeof value === "string") {
    if (/(not connected|no active connection|connected account not found|connect(?:ed)? account|required.*connection|authentication required|requires authentication)/i.test(value)) {
      state.missingConnection = true
    }
    return
  }

  if (Array.isArray(value)) {
    for (const entry of value) collectConnectionSignals(entry, links, toolkits, state, inheritedToolkit)
    return
  }

  const record = asRecord(value)
  if (!record) return

  const currentToolkit = toolkitFromRecord(record) ?? inheritedToolkit
  addUnique(toolkits, currentToolkit)

  for (const [key, entry] of Object.entries(record)) {
    const stringValue = optionalString(entry)
    if (stringValue !== undefined && URL_KEYS.has(key) && isHttpUrl(stringValue)) {
      links.push({
        ...(currentToolkit === undefined ? {} : { toolkit: currentToolkit }),
        url: stringValue,
        source: key,
      })
    }

    collectConnectionSignals(entry, links, toolkits, state, currentToolkit)
  }
}

function dedupeLinks(links: readonly ConnectionLink[]): ConnectionLink[] {
  const seen = new Set<string>()
  const deduped: ConnectionLink[] = []

  for (const link of links) {
    const key = `${link.toolkit ?? ""}:${link.url}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(link)
  }

  return deduped
}

export function normalizeConnectionGuidance(
  payload: Record<string, unknown>,
  options: ConnectionGuidanceOptions = {},
): ConnectionGuidance | null {
  const links: ConnectionLink[] = []
  const toolkits = new Set<string>()
  const state = { missingConnection: false }

  for (const toolkit of options.requestedToolkits ?? []) addUnique(toolkits, optionalString(toolkit)?.toLowerCase())
  for (const slug of options.toolSlugs ?? []) addUnique(toolkits, inferToolkitFromToolSlug(slug))

  collectConnectionSignals(payload, links, toolkits, state)

  const connectionLinks = dedupeLinks(links)
  const connectionRequired = connectionLinks.length > 0 || state.missingConnection
  if (!connectionRequired) return null

  const normalizedToolkits = [...toolkits].sort()
  const nextSteps = connectionLinks.length > 0
    ? [
        "Open the connection link manually.",
        "Complete authorization in Composio.",
        "Retry the original Composio tool call.",
      ]
    : [
        normalizedToolkits.length > 0
          ? `Call composio_manage_connections with toolkits: ${normalizedToolkits.join(", ")}.`
          : "Call composio_manage_connections with the toolkit required by the failed tool.",
        "Open the returned connection link manually.",
        "Complete authorization in Composio, then retry the original tool call.",
      ]

  return {
    ok: false,
    code: "COMPOSIO_CONNECTION_REQUIRED",
    connectionRequired: true,
    toolkits: normalizedToolkits,
    connectionLinks,
    nextSteps,
  }
}

export function renderConnectionGuidance(guidance: ConnectionGuidance, toolName: string): string {
  const toolkitLabel = guidance.toolkits.length === 1 ? titleCase(guidance.toolkits[0] ?? "account") : "Account"
  const lines = [`## Connect ${toolkitLabel}`, ""]

  lines.push(`Composio needs ${guidance.toolkits.length === 1 ? `your ${toolkitLabel} account` : "an account"} connected before it can continue with \`${toolName}\`.`)
  lines.push("")

  if (guidance.connectionLinks.length > 0) {
    for (const link of guidance.connectionLinks) {
      const label = link.toolkit === undefined ? "Connect account" : `Connect ${titleCase(link.toolkit)}`
      lines.push(`[${label}](${link.url})`)
    }
  } else {
    lines.push("No connection link was returned yet. Ask the agent to call `composio_manage_connections` for the required toolkit, then open the returned link manually.")
  }

  lines.push("")
  lines.push("After connecting, retry the original Composio tool call.")

  return lines.join("\n")
}

export const __connectionGuidanceTestUtils = {
  inferToolkitFromToolSlug,
  isHttpUrl,
  titleCase,
}
