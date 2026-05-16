import { getAnonymousUserDataPath, readAnonymousUserData } from "./anonymous-user-data"

export type ComposioAuthSource = "env" | "anonymous" | null

export type ComposioAuthDebug = {
  apiKeyPresent: boolean
  authSource: ComposioAuthSource
  envKeyPrecedence: boolean
  anonymousDataPresent: boolean
}

export type ResolvedComposioAuth = {
  apiKey?: string
  source: ComposioAuthSource
  anonymousPath: string
  debug: ComposioAuthDebug
}

export type ResolveComposioAuthOptions = {
  env?: Record<string, string | undefined>
  home?: string
}

export async function resolveComposioAuth(
  options: ResolveComposioAuthOptions = {},
): Promise<ResolvedComposioAuth> {
  const env = options.env ?? process.env
  const anonymousPath = getAnonymousUserDataPath(options.home)
  const anonymousData = await readAnonymousUserData(
    options.home === undefined ? {} : { home: options.home },
  )
  const anonymousDataPresent = anonymousData !== null
  const envKey = env.COMPOSIO_API_KEY?.trim()

  if (envKey) {
    return {
      apiKey: envKey,
      source: "env",
      anonymousPath,
      debug: {
        apiKeyPresent: true,
        authSource: "env",
        envKeyPrecedence: true,
        anonymousDataPresent,
      },
    }
  }

  const anonymousApiKey = anonymousData?.composio?.api_key?.trim()
  if (anonymousApiKey) {
    return {
      apiKey: anonymousApiKey,
      source: "anonymous",
      anonymousPath,
      debug: {
        apiKeyPresent: true,
        authSource: "anonymous",
        envKeyPrecedence: false,
        anonymousDataPresent,
      },
    }
  }

  return {
    source: null,
    anonymousPath,
    debug: {
      apiKeyPresent: false,
      authSource: null,
      envKeyPrecedence: false,
      anonymousDataPresent,
    },
  }
}

export function getMissingCredentialMessage(): string {
  return [
    "No Composio credentials are available.",
    "First call the composio_signup tool to create and persist anonymous Composio credentials automatically.",
    "Manual COMPOSIO_API_KEY setup is supported for CI or power users, but signup is the default first path.",
  ].join(" ")
}
