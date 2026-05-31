export const DEFAULT_COMPOSIO_API_BASE_URL = "https://backend.composio.dev/api/v3.1"
export const DEFAULT_COMPOSIO_AGENT_BASE_URL = "https://agents.composio.dev"

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "")
}

export function getComposioApiBaseUrl(env: Record<string, string | undefined> = process.env): string {
  return normalizeBaseUrl(env.COMPOSIO_API_BASE_URL?.trim() || DEFAULT_COMPOSIO_API_BASE_URL)
}

export function getComposioAgentBaseUrl(env: Record<string, string | undefined> = process.env): string {
  return normalizeBaseUrl(env.COMPOSIO_AGENT_BASE_URL?.trim() || DEFAULT_COMPOSIO_AGENT_BASE_URL)
}
