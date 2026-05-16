import { stat } from "node:fs/promises"

import {
  getAnonymousUserDataPath,
  readAnonymousUserData,
  writeAnonymousUserData,
  type AnonymousUserData,
} from "./anonymous-user-data"
import { signUpAgent, whoAmI, type FetchImpl } from "./agent-api"
import { UserFacingError } from "./errors"

export type AnonymousIdentitySummary = {
  ok: true
  status: string
  reused: boolean
  source: "anonymous"
  slug?: string
  email?: string
  orgId?: string
  projectId?: string
  anonymousDataPath: string
  restrictivePermissions?: boolean
}

export type EnsureAnonymousIdentityOptions = {
  home?: string
  fetchImpl?: FetchImpl
  baseUrl?: string
  wait?: boolean
}

function isReady(data: AnonymousUserData | null | undefined): data is AnonymousUserData {
  return data?.status?.toLowerCase() === "ready"
}

function hasUsableApiKey(data: AnonymousUserData | null | undefined): data is AnonymousUserData {
  return typeof data?.composio?.api_key === "string" && data.composio.api_key.trim().length > 0
}

async function hasRestrictivePermissions(path: string): Promise<boolean | undefined> {
  if (process.platform === "win32") return undefined
  try {
    const mode = (await stat(path)).mode & 0o777
    return (mode & 0o077) === 0
  } catch {
    return undefined
  }
}

async function toSummary(data: AnonymousUserData, reused: boolean, anonymousDataPath: string): Promise<AnonymousIdentitySummary> {
  const summary: AnonymousIdentitySummary = {
    ok: true,
    status: data.status ?? "ready",
    reused,
    source: "anonymous",
    anonymousDataPath,
  }

  if (data.slug) summary.slug = data.slug
  if (data.email) summary.email = data.email
  if (data.composio?.org_id) summary.orgId = data.composio.org_id
  if (data.composio?.project_id) summary.projectId = data.composio.project_id

  const restrictivePermissions = await hasRestrictivePermissions(anonymousDataPath)
  if (restrictivePermissions !== undefined) summary.restrictivePermissions = restrictivePermissions

  return summary
}

export async function ensureAnonymousIdentity(
  options: EnsureAnonymousIdentityOptions = {},
): Promise<AnonymousIdentitySummary> {
  const anonymousDataPath = getAnonymousUserDataPath(options.home)
  const existing = await readAnonymousUserData({ home: options.home })

  if (existing?.agent_key) {
    try {
      const verified = await whoAmI(existing.agent_key, {
        fetchImpl: options.fetchImpl,
        baseUrl: options.baseUrl,
      })

      if (isReady(verified) && hasUsableApiKey(existing)) {
        return toSummary(
          {
            ...existing,
            status: verified.status ?? existing.status,
            slug: verified.slug ?? existing.slug,
            email: verified.email ?? existing.email,
            composio: {
              ...existing.composio,
              org_id: verified.composio?.org_id ?? existing.composio?.org_id,
              project_id: verified.composio?.project_id ?? existing.composio?.project_id,
            },
          },
          true,
          anonymousDataPath,
        )
      }
    } catch {
      // Stale, revoked, or malformed local agent credentials should not block first-use signup.
    }
  }

  const signedUp = await signUpAgent({
    fetchImpl: options.fetchImpl,
    baseUrl: options.baseUrl,
    wait: options.wait,
  })

  if (!isReady(signedUp) || !hasUsableApiKey(signedUp)) {
    throw new UserFacingError("AGENT_SIGNUP_NOT_READY", "Composio agent signup did not return ready credentials.", signedUp)
  }

  await writeAnonymousUserData(signedUp, { home: options.home })
  return toSummary(signedUp, false, anonymousDataPath)
}
