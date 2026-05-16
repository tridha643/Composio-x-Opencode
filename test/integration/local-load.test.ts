import { describe, expect, test } from "bun:test"
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import type { Plugin, PluginInput } from "@opencode-ai/plugin"

import { COMPOSIO_TOOL_NAMES } from "../../src/plugin/manifest"

function createPluginInput(): PluginInput {
  return {
    client: {} as PluginInput["client"],
    project: {} as PluginInput["project"],
    directory: process.cwd(),
    worktree: process.cwd(),
    experimental_workspace: {
      register() {},
    },
    serverUrl: new URL("http://localhost"),
    $: (() => {}) as unknown as PluginInput["$"],
  }
}

describe("local build output", () => {
  test("loads dist/index.js and registers every static Composio tool", async () => {
    const distIndexPath = resolve(process.cwd(), "dist/index.js")

    if (!existsSync(distIndexPath)) {
      throw new Error("dist/index.js is missing. Run `bun run build` before `bun run test:integration`.")
    }

    const builtModule = (await import(pathToFileURL(distIndexPath).href)) as {
      default?: Plugin
    }

    expect(builtModule.default).toBeFunction()
    const builtPlugin = builtModule.default as Plugin

    const hooks = await builtPlugin(createPluginInput())

    expect(Object.keys(hooks.tool ?? {})).toEqual([...COMPOSIO_TOOL_NAMES])
  })
})
