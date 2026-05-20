import { UserFacingError } from "../auth/errors"
import { redactSecrets } from "../auth/redact"
import {
  getMissingCredentialMessage,
  resolveComposioAuth,
  type ResolveComposioAuthOptions,
} from "../auth/resolve-auth"

const DEFAULT_COMPOSIO_BASE_URL = "https://backend.composio.dev"
const MAX_ERROR_BODY_CHARS = 2_000

export type FetchImpl = typeof fetch

export type ComposioClientOptions = ResolveComposioAuthOptions & {
  fetchImpl?: FetchImpl
  baseUrl?: string
}

export type ComposioJsonRequest = {
  path: string
  method?: "GET" | "POST" | "PATCH" | "DELETE"
  body?: unknown
  knownSecrets?: readonly string[]
}

function normalizeBaseUrl(baseUrl = DEFAULT_COMPOSIO_BASE_URL): string {
  return baseUrl.replace(/\/+$/, "")
}

function endpointUrl(path: string, baseUrl?: string): URL {
  const cleanPath = path.replace(/^\/+/, "")
  return new URL(cleanPath, `${normalizeBaseUrl(baseUrl)}/`)
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

  return redactSecrets(
    {
      status: response.status,
      statusText: response.statusText,
      body,
    },
    knownSecrets,
  )
}

export async function requestComposioJson(
  request: ComposioJsonRequest,
  options: ComposioClientOptions = {},
): Promise<unknown> {
  const auth = await resolveComposioAuth(options)

  if (!auth.apiKey) {
    throw new UserFacingError("MISSING_COMPOSIO_CREDENTIALS", getMissingCredentialMessage(), {
      auth: auth.debug,
      anonymousPath: auth.anonymousPath,
    })
  }

  const knownSecrets = [auth.apiKey, ...(request.knownSecrets ?? [])]
  const response = await (options.fetchImpl ?? fetch)(endpointUrl(request.path, options.baseUrl), {
    method: request.method ?? "POST",
    headers: {
      authorization: `Bearer ${auth.apiKey}`,
      "content-type": "application/json",
    },
    body: request.body === undefined ? undefined : JSON.stringify(request.body),
  }).catch((error: unknown) => {
    throw new UserFacingError("COMPOSIO_NETWORK_ERROR", "Composio request failed before receiving a response.", {
      error: redactSecrets(error, knownSecrets),
    })
  })

  if (!response.ok) {
    throw new UserFacingError("COMPOSIO_HTTP_ERROR", "Composio request returned an error response.", {
      request: {
        path: request.path,
        method: request.method ?? "POST",
      },
      response: await safeErrorDetails(response, knownSecrets),
    })
  }

  if (response.status === 204) {
    return {}
  }

  try {
    const text = await response.text()
    if (text.trim().length === 0) return {}

    return redactSecrets(JSON.parse(text), knownSecrets)
  } catch (error) {
    throw new UserFacingError("COMPOSIO_INVALID_JSON", "Composio request returned invalid JSON.", {
      request: {
        path: request.path,
        method: request.method ?? "POST",
      },
      parseError: error instanceof Error ? error.message : String(error),
    })
  }
}

export const __composioClientTestUtils = {
  endpointUrl,
  normalizeBaseUrl,
}
