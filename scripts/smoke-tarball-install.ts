import { spawnSync } from "node:child_process"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { COMPOSIO_TOOL_NAMES } from "../src/plugin/manifest"
import { PACKAGE_NAME, PACKAGE_VERSION } from "../src/shared/version"

type NpmPackResult = {
  filename: string
}

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..")

function fail(message: string): never {
  console.error(`smoke:tarball failed: ${message}`)
  process.exit(1)
}

function run(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv = process.env) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: "utf8",
  })

  if (result.status !== 0) {
    fail(
      `${command} ${args.join(" ")} exited with ${result.status ?? "unknown status"}\n${result.stderr}${result.stdout}`,
    )
  }

  return result.stdout
}

function packTarball(packDestination: string): string {
  const stdout = run("npm", ["pack", "--json", "--pack-destination", packDestination], rootDir)

  let parsed: unknown
  try {
    parsed = JSON.parse(stdout)
  } catch (error) {
    fail(`npm pack did not return JSON: ${(error as Error).message}\n${stdout}`)
  }

  if (!Array.isArray(parsed) || parsed.length !== 1 || typeof (parsed[0] as Partial<NpmPackResult>).filename !== "string") {
    fail(`npm pack returned unexpected result shape: ${stdout}`)
  }

  return join(packDestination, (parsed[0] as NpmPackResult).filename)
}

const tempDir = await mkdtemp(join(tmpdir(), "composio-x-opencode-tarball-smoke-"))
const packDir = join(tempDir, "pack")
const projectDir = join(tempDir, "project")

try {
  await mkdir(packDir)
  await mkdir(projectDir)

  const tarballPath = packTarball(packDir)

  await writeFile(
    join(projectDir, "package.json"),
    JSON.stringify({ private: true, type: "module" }, null, 2),
  )

  run("bun", ["install", tarballPath], projectDir)

  await writeFile(
    join(projectDir, "smoke-installed-plugin.mjs"),
    `
const expectedToolNames = JSON.parse(process.env.EXPECTED_TOOL_NAMES ?? "[]")
const expectedPackageName = process.env.EXPECTED_PACKAGE_NAME
const expectedPackageVersion = process.env.EXPECTED_PACKAGE_VERSION
const { default: plugin } = await import("composio-x-opencode")

if (typeof plugin !== "function") {
  throw new Error("Package does not export a default opencode plugin function")
}

const input = {
  client: {},
  project: {},
  directory: process.cwd(),
  worktree: process.cwd(),
  experimental_workspace: { register() {} },
  serverUrl: new URL("http://localhost"),
  $: () => {},
}

const fetchCalls = []
globalThis.fetch = (...args) => {
  fetchCalls.push(args)
  throw new Error("Installed plugin load/debug smoke must not call fetch")
}

const hooks = await plugin(input)
const actualToolNames = Object.keys(hooks.tool ?? {})

if (JSON.stringify(actualToolNames) !== JSON.stringify(expectedToolNames)) {
  throw new Error(\`registered tool mismatch. Expected \${expectedToolNames.join(", ")}; got \${actualToolNames.join(", ")}\`)
}

const debugTool = hooks.tool?.composio_debug_info
if (!debugTool?.execute) {
  throw new Error("Installed plugin did not register composio_debug_info")
}

const result = await debugTool.execute({}, {
  sessionID: "tarball-smoke-session",
  messageID: "tarball-smoke-message",
  agent: "tarball-smoke-agent",
  directory: process.cwd(),
  worktree: process.cwd(),
  abort: new AbortController().signal,
  metadata() {},
  ask() {},
})

const parsed = JSON.parse(typeof result === "string" ? result : result?.output ?? "{}")
if (fetchCalls.length !== 0) {
  throw new Error("Installed plugin load/debug made network calls")
}
if (parsed.packageName !== expectedPackageName) {
  throw new Error(\`unexpected packageName in debug info: \${parsed.packageName}\`)
}
if (parsed.packageVersion !== expectedPackageVersion) {
  throw new Error(\`unexpected packageVersion in debug info: \${parsed.packageVersion}\`)
}
if (JSON.stringify(parsed.registeredTools) !== JSON.stringify(expectedToolNames)) {
  throw new Error("debug info registeredTools did not match installed registry")
}
`,
  )

  run("bun", ["smoke-installed-plugin.mjs"], projectDir, {
    ...process.env,
    EXPECTED_PACKAGE_NAME: PACKAGE_NAME,
    EXPECTED_PACKAGE_VERSION: PACKAGE_VERSION,
    EXPECTED_TOOL_NAMES: JSON.stringify([...COMPOSIO_TOOL_NAMES]),
  })

  console.log(`smoke:tarball ok: installed ${tarballPath} and verified ${COMPOSIO_TOOL_NAMES.length} tools`)
} finally {
  await rm(tempDir, { recursive: true, force: true })
}
