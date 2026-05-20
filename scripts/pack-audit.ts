import { spawnSync } from "node:child_process"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { PACKAGE_NAME, PACKAGE_VERSION } from "../src/shared/version"

type NpmPackFile = {
  path: string
}

type NpmPackResult = {
  filename: string
  files: NpmPackFile[]
}

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..")

const requiredPaths = new Set([
  "package.json",
  "README.md",
  "LICENSE",
  "dist/index.js",
  "dist/index.d.ts",
])

const forbiddenPatterns: RegExp[] = [
  /^\.planning(?:\/|$)/,
  /^\.opencode(?:\/|$)/,
  /^src(?:\/|$)/,
  /^test(?:\/|$)/,
  /^scripts(?:\/|$)/,
  /^examples(?:\/|$)/,
  /^\.env(?:\.|$)/,
  /(?:^|\/)anonymous_user_data\.json$/,
  /(?:^|\/)composio-claim-report.*\.json$/,
  /(?:^|\/)composio-automations\.json$/,
  /\.tgz$/,
  /\.map$/,
]

function fail(message: string): never {
  console.error(`pack:audit failed: ${message}`)
  process.exit(1)
}

function runNpmPack(packDestination: string): NpmPackResult {
  const result = spawnSync("npm", ["pack", "--json", "--pack-destination", packDestination], {
    cwd: rootDir,
    encoding: "utf8",
  })

  if (result.status !== 0) {
    fail(`npm pack exited with ${result.status ?? "unknown status"}\n${result.stderr}${result.stdout}`)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(result.stdout)
  } catch (error) {
    fail(`npm pack did not return JSON: ${(error as Error).message}\n${result.stdout}`)
  }

  if (!Array.isArray(parsed) || parsed.length !== 1) {
    fail(`npm pack returned unexpected result shape: ${result.stdout}`)
  }

  const packResult = parsed[0] as Partial<NpmPackResult>
  if (!packResult.filename || !Array.isArray(packResult.files)) {
    fail(`npm pack result is missing filename/files: ${result.stdout}`)
  }

  return packResult as NpmPackResult
}

function assertPackFiles(paths: string[]) {
  for (const requiredPath of requiredPaths) {
    if (!paths.includes(requiredPath)) {
      fail(`missing required package file: ${requiredPath}`)
    }
  }

  const forbidden = paths.filter((path) => forbiddenPatterns.some((pattern) => pattern.test(path)))
  if (forbidden.length > 0) {
    fail(`forbidden package files included: ${forbidden.join(", ")}`)
  }
}

async function assertPackageMetadata() {
  const packageJson = JSON.parse(await readFile(join(rootDir, "package.json"), "utf8")) as {
    name?: string
    version?: string
    license?: string
    files?: string[]
  }

  if (packageJson.name !== PACKAGE_NAME) {
    fail(`package.json name ${packageJson.name ?? "<missing>"} does not match ${PACKAGE_NAME}`)
  }
  if (packageJson.version !== PACKAGE_VERSION) {
    fail(`package.json version ${packageJson.version ?? "<missing>"} does not match ${PACKAGE_VERSION}`)
  }
  if (packageJson.license !== "MIT") {
    fail(`package.json license must be MIT; got ${packageJson.license ?? "<missing>"}`)
  }
  for (const requiredFileEntry of ["dist", "README.md", "LICENSE"]) {
    if (!packageJson.files?.includes(requiredFileEntry)) {
      fail(`package.json files must include ${requiredFileEntry}`)
    }
  }
}

const tempDir = await mkdtemp(join(tmpdir(), "composio-x-opencode-pack-audit-"))

try {
  await assertPackageMetadata()

  const packResult = runNpmPack(tempDir)
  const paths = packResult.files.map((file) => file.path).sort()

  assertPackFiles(paths)

  console.log(
    `pack:audit ok: ${paths.length} files inspected from ${packResult.filename}; required files present and forbidden files absent`,
  )
} finally {
  await rm(tempDir, { recursive: true, force: true })
}
