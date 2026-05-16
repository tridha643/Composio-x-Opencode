import { randomUUID } from "node:crypto"
import { constants } from "node:fs"
import { access, chmod, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { basename, dirname, join } from "node:path"

export type AnonymousComposioData = {
  member_id?: string
  org_id?: string
  project_id?: string
  api_key?: string
  user_api_key?: string
}

export type AnonymousUserData = {
  status?: string
  request_id?: string
  slug?: string
  email?: string
  agent_key?: string
  composio?: AnonymousComposioData
}

export type AnonymousUserDataOptions = {
  home?: string
  path?: string
}

export function getAnonymousUserDataPath(home = homedir()): string {
  return join(home, ".composio", "anonymous_user_data.json")
}

function resolveAnonymousUserDataPath(options: AnonymousUserDataOptions = {}): string {
  return options.path ?? getAnonymousUserDataPath(options.home)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined
}

function parseAnonymousUserData(value: unknown): AnonymousUserData | null {
  if (!isRecord(value)) return null

  const composioValue = value.composio
  if (composioValue !== undefined && !isRecord(composioValue)) return null

  const data: AnonymousUserData = {}
  const status = optionalString(value.status)
  const requestId = optionalString(value.request_id)
  const slug = optionalString(value.slug)
  const email = optionalString(value.email)
  const agentKey = optionalString(value.agent_key)

  if (status !== undefined) data.status = status
  if (requestId !== undefined) data.request_id = requestId
  if (slug !== undefined) data.slug = slug
  if (email !== undefined) data.email = email
  if (agentKey !== undefined) data.agent_key = agentKey

  if (isRecord(composioValue)) {
    const composio: AnonymousComposioData = {}
    const memberId = optionalString(composioValue.member_id)
    const orgId = optionalString(composioValue.org_id)
    const projectId = optionalString(composioValue.project_id)
    const apiKey = optionalString(composioValue.api_key)
    const userApiKey = optionalString(composioValue.user_api_key)

    if (memberId !== undefined) composio.member_id = memberId
    if (orgId !== undefined) composio.org_id = orgId
    if (projectId !== undefined) composio.project_id = projectId
    if (apiKey !== undefined) composio.api_key = apiKey
    if (userApiKey !== undefined) composio.user_api_key = userApiKey
    data.composio = composio
  }

  if (!data.composio && !data.agent_key && !data.status) return null

  return data
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function chmodBestEffort(path: string, mode: number): Promise<void> {
  if (process.platform === "win32") return
  await chmod(path, mode).catch(() => undefined)
}

export async function readAnonymousUserData(
  options: AnonymousUserDataOptions = {},
): Promise<AnonymousUserData | null> {
  const path = resolveAnonymousUserDataPath(options)

  if (!(await exists(path))) return null

  try {
    return parseAnonymousUserData(JSON.parse(await readFile(path, "utf8")))
  } catch {
    return null
  }
}

export async function writeAnonymousUserData(
  data: AnonymousUserData,
  options: AnonymousUserDataOptions = {},
): Promise<void> {
  const path = resolveAnonymousUserDataPath(options)
  const dir = dirname(path)
  const tmp = join(dir, `.${basename(path)}.${randomUUID()}.tmp`)

  await mkdir(dir, { recursive: true, mode: 0o700 })
  await chmodBestEffort(dir, 0o700)

  try {
    await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, { encoding: "utf8", mode: 0o600 })
    await chmodBestEffort(tmp, 0o600)
    await rename(tmp, path)
    await chmodBestEffort(path, 0o600)
  } catch (error) {
    await unlink(tmp).catch(() => undefined)
    throw error
  }
}
