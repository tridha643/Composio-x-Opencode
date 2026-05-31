import { createHash, randomUUID } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"
import { tool, type ToolDefinition } from "@opencode-ai/plugin"

import { toToolErrorPayload } from "../auth/errors"
import { formatToolResult } from "./format"

export type CreateHandoffToolOptions = {
  home?: string
}

function automationDir(home = homedir()): string {
  return join(home, ".composio", "opencode", "automations")
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "automation"
}

function stableDigest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 12)
}

export function createSaveAutomationDefinitionTool(options: CreateHandoffToolOptions = {}): ToolDefinition {
  return tool({
    description: "Persist a Pi-compatible automation definition as a local Composio handoff artifact.",
    args: {
      name: tool.schema.string(),
      description: tool.schema.string().optional(),
      trigger: tool.schema.record(tool.schema.string(), tool.schema.unknown()).optional(),
      steps: tool.schema.array(tool.schema.record(tool.schema.string(), tool.schema.unknown())).min(1),
      metadata: tool.schema.record(tool.schema.string(), tool.schema.unknown()).optional(),
    },
    async execute(args) {
      try {
        const id = `auto_${slugify(args.name)}_${stableDigest({ name: args.name, steps: args.steps, nonce: randomUUID() })}`
        const path = join(automationDir(options.home), `${id}.json`)
        const payload = {
          id,
          schemaVersion: 1,
          createdAt: new Date().toISOString(),
          source: "composio-x-opencode",
          definition: args,
        }

        await mkdir(automationDir(options.home), { recursive: true, mode: 0o700 })
        await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`, { encoding: "utf8", mode: 0o600 })

        return formatToolResult("Automation definition saved", {
          ok: true,
          automationId: id,
          path,
          replay: {
            tool: "save_automation_definition",
            file: path,
          },
        })
      } catch (error) {
        return formatToolResult("Automation definition save failed", toToolErrorPayload(error) as unknown as Record<string, unknown>)
      }
    },
  })
}
