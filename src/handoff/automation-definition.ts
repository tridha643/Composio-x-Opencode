import { randomUUID } from "node:crypto"
import { readFile, mkdir, rename, unlink, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { basename, dirname, isAbsolute, join, resolve } from "node:path"

import { UserFacingError } from "../auth/errors"

export const AUTOMATIONS_FILE_ENV = "PI_COMPOSIO_AUTOMATIONS_JSON"

type JsonRecord = Record<string, unknown>

export type SaveAutomationDefinitionInput = {
  name: string
  triggerId: string
  triggerSlug: string
  instructions: string
  enabled?: boolean
  metadata?: JsonRecord
  filePath?: string
}

export type AutomationDefinition = JsonRecord & {
  name: string
  triggerId: string
  triggerSlug: string
  instructions: string
  updatedAt: string
  enabled?: boolean
  metadata?: JsonRecord
}

export type SaveAutomationDefinitionResult = {
  ok: true
  filePath: string
  operation: "inserted" | "updated"
  automation: AutomationDefinition
}

export type AutomationDefinitionOptions = {
  env?: NodeJS.ProcessEnv
  home?: string
  cwd?: string
  now?: () => Date
  readFileImpl?: typeof readFile
  mkdirImpl?: typeof mkdir
  writeFileImpl?: typeof writeFile
  renameImpl?: typeof rename
  unlinkImpl?: typeof unlink
}

function optionEnv(options: AutomationDefinitionOptions): NodeJS.ProcessEnv {
  return options.env ?? process.env
}

function optionHome(options: AutomationDefinitionOptions): string {
  return options.home ?? homedir()
}

function optionCwd(options: AutomationDefinitionOptions): string {
  return options.cwd ?? process.cwd()
}

export function defaultAutomationsFilePath(home = homedir()): string {
  return join(home, ".config", "pi", "composio-automations.json")
}

function expandHomePath(filePath: string, home: string): string {
  if (filePath === "~") return home
  if (filePath.startsWith("~/") || filePath.startsWith("~\\")) return join(home, filePath.slice(2))
  return filePath
}

export function resolveAutomationDefinitionFilePath(
  input: Pick<SaveAutomationDefinitionInput, "filePath"> = {},
  options: AutomationDefinitionOptions = {},
): string {
  const envPath = optionEnv(options)[AUTOMATIONS_FILE_ENV]?.trim() || undefined
  const configuredPath = input.filePath?.trim() || envPath || defaultAutomationsFilePath(optionHome(options))
  const expandedPath = expandHomePath(configuredPath, optionHome(options))

  return isAbsolute(expandedPath) ? resolve(expandedPath) : resolve(optionCwd(options), expandedPath)
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT")
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null
}

async function readExistingAutomations(
  filePath: string,
  options: AutomationDefinitionOptions,
): Promise<unknown[]> {
  const readFileImpl = options.readFileImpl ?? readFile
  let raw: string

  try {
    raw = await readFileImpl(filePath, "utf8")
  } catch (error) {
    if (isMissingFileError(error)) return []
    throw error
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new UserFacingError(
      "INVALID_AUTOMATIONS_FILE",
      `Automation file ${filePath} must contain a valid JSON array.`,
      { filePath },
    )
  }

  if (!Array.isArray(parsed)) {
    throw new UserFacingError(
      "INVALID_AUTOMATIONS_FILE",
      `Automation file ${filePath} must contain a JSON array.`,
      { filePath },
    )
  }

  return parsed
}

async function writeAutomationsAtomically(
  filePath: string,
  automations: readonly unknown[],
  options: AutomationDefinitionOptions,
): Promise<void> {
  const mkdirImpl = options.mkdirImpl ?? mkdir
  const writeFileImpl = options.writeFileImpl ?? writeFile
  const renameImpl = options.renameImpl ?? rename
  const unlinkImpl = options.unlinkImpl ?? unlink
  const dir = dirname(filePath)
  const tmp = join(dir, `.${basename(filePath)}.${randomUUID()}.tmp`)

  await mkdirImpl(dir, { recursive: true })

  try {
    await writeFileImpl(tmp, `${JSON.stringify(automations, null, 2)}\n`, { encoding: "utf8", mode: 0o600 })
    await renameImpl(tmp, filePath)
  } catch (error) {
    await unlinkImpl(tmp).catch(() => undefined)
    throw error
  }
}

export async function saveAutomationDefinition(
  input: SaveAutomationDefinitionInput,
  options: AutomationDefinitionOptions = {},
): Promise<SaveAutomationDefinitionResult> {
  const filePath = resolveAutomationDefinitionFilePath(input, options)
  const existing = await readExistingAutomations(filePath, options)
  const existingIndex = existing.findIndex((entry) => asRecord(entry)?.triggerId === input.triggerId)
  const previous = existingIndex >= 0 ? asRecord(existing[existingIndex]) : null
  const automation: AutomationDefinition = {
    name: input.name,
    triggerId: input.triggerId,
    triggerSlug: input.triggerSlug,
    instructions: input.instructions,
    updatedAt: (options.now ?? (() => new Date()))().toISOString(),
  }

  if (input.enabled !== undefined) automation.enabled = input.enabled
  if (input.metadata !== undefined) automation.metadata = input.metadata

  if (existingIndex >= 0) {
    existing[existingIndex] = { ...(previous ?? {}), ...automation }
  } else {
    existing.push(automation)
  }

  await writeAutomationsAtomically(filePath, existing, options)

  return {
    ok: true,
    filePath,
    operation: existingIndex >= 0 ? "updated" : "inserted",
    automation: existing[existingIndex >= 0 ? existingIndex : existing.length - 1] as AutomationDefinition,
  }
}
