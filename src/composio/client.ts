import { UserFacingError } from "../auth/errors"
import { type FetchImpl } from "../auth/agent-api"
import { redactSecrets } from "../auth/redact"
import { getComposioApiBaseUrl, normalizeBaseUrl } from "./config"

const MAX_ERROR_BODY_CHARS = 2_000

export type QueryValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly (string | number | boolean)[]
  | Record<string, unknown>

export type ComposioApiClientOptions = {
  apiKey: string
  baseUrl?: string
  fetchImpl?: FetchImpl
}

export type ComposioRequestOptions = {
  query?: Record<string, QueryValue>
  body?: unknown
  signal?: AbortSignal
}

function appendQuery(url: URL, query: Record<string, QueryValue> | undefined) {
  if (!query) return

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue
    if (Array.isArray(value)) {
      for (const entry of value) {
        url.searchParams.append(key, String(entry))
      }
      continue
    }

    url.searchParams.set(key, typeof value === "object" ? JSON.stringify(value) : String(value))
  }
}

async function readJsonOrText(response: Response): Promise<unknown> {
  if (response.status === 204) return {}

  const contentType = response.headers.get("content-type") ?? ""
  if (contentType.toLowerCase().includes("json")) {
    return response.json()
  }

  const text = await response.text()
  return text ? text.slice(0, MAX_ERROR_BODY_CHARS) : {}
}

export class ComposioApiClient {
  readonly baseUrl: string
  readonly apiKey: string
  private readonly fetchImpl: FetchImpl

  constructor(options: ComposioApiClientOptions) {
    this.apiKey = options.apiKey
    this.baseUrl = normalizeBaseUrl(options.baseUrl ?? getComposioApiBaseUrl())
    this.fetchImpl = options.fetchImpl ?? fetch
  }

  async request(method: string, path: string, options: ComposioRequestOptions = {}): Promise<unknown> {
    const url = new URL(path.replace(/^\/+/, ""), `${this.baseUrl}/`)
    appendQuery(url, options.query)

    const headers: Record<string, string> = {
      "x-api-key": this.apiKey,
    }
    const init: RequestInit = {
      method,
      headers,
    }
    if (options.signal !== undefined) init.signal = options.signal

    if (options.body !== undefined) {
      headers["content-type"] = "application/json"
      init.body = JSON.stringify(options.body)
    }

    let response: Response
    try {
      response = await this.fetchImpl(url, init)
    } catch (error) {
      throw new UserFacingError("COMPOSIO_NETWORK_ERROR", "Composio API request failed before receiving a response.", {
        method,
        path,
        error: error instanceof Error ? error.message : String(error),
      })
    }

    const payload = await readJsonOrText(response).catch((error) => {
      throw new UserFacingError("COMPOSIO_INVALID_RESPONSE", "Composio API returned an unreadable response.", {
        method,
        path,
        status: response.status,
        statusText: response.statusText,
        error: error instanceof Error ? error.message : String(error),
      })
    })

    if (!response.ok) {
      throw new UserFacingError("COMPOSIO_API_ERROR", "Composio API request failed.", {
        method,
        path,
        status: response.status,
        statusText: response.statusText,
        body: redactSecrets(payload, [this.apiKey]),
      })
    }

    return redactSecrets(payload, [this.apiKey])
  }
}
