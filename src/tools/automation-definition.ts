import { tool, type ToolContext, type ToolDefinition } from "@opencode-ai/plugin"

import { toToolErrorPayload } from "../auth/errors"
import {
  saveAutomationDefinition,
  type AutomationDefinitionOptions,
  type SaveAutomationDefinitionInput,
  type SaveAutomationDefinitionResult,
} from "../handoff/automation-definition"

type JsonRecord = Record<string, unknown>

type SaveAutomationDefinitionService = (
  input: SaveAutomationDefinitionInput,
  options: AutomationDefinitionOptions,
) => Promise<SaveAutomationDefinitionResult>

export type CreateSaveAutomationDefinitionToolOptions = AutomationDefinitionOptions & {
  saveAutomationDefinitionService?: SaveAutomationDefinitionService
}

const jsonRecordSchema = tool.schema.record(tool.schema.string(), tool.schema.unknown())

function formatResult(title: string, payload: JsonRecord) {
  return {
    title,
    output: JSON.stringify(payload, null, 2),
    metadata: payload,
  }
}

function serviceOptions(options: CreateSaveAutomationDefinitionToolOptions, context: ToolContext): AutomationDefinitionOptions {
  const output: AutomationDefinitionOptions = { cwd: options.cwd ?? context.directory }
  if (options.env !== undefined) output.env = options.env
  if (options.home !== undefined) output.home = options.home
  if (options.now !== undefined) output.now = options.now
  if (options.readFileImpl !== undefined) output.readFileImpl = options.readFileImpl
  if (options.mkdirImpl !== undefined) output.mkdirImpl = options.mkdirImpl
  if (options.writeFileImpl !== undefined) output.writeFileImpl = options.writeFileImpl
  if (options.renameImpl !== undefined) output.renameImpl = options.renameImpl
  if (options.unlinkImpl !== undefined) output.unlinkImpl = options.unlinkImpl
  return output
}

function saveAutomationInput(args: {
  name: string
  triggerId: string
  triggerSlug: string
  instructions: string
  enabled?: boolean | undefined
  metadata?: JsonRecord | undefined
  filePath?: string | undefined
}): SaveAutomationDefinitionInput {
  const input: SaveAutomationDefinitionInput = {
    name: args.name,
    triggerId: args.triggerId,
    triggerSlug: args.triggerSlug,
    instructions: args.instructions,
  }
  if (args.enabled !== undefined) input.enabled = args.enabled
  if (args.metadata !== undefined) input.metadata = args.metadata
  if (args.filePath !== undefined) input.filePath = args.filePath
  return input
}

export function createSaveAutomationDefinitionTool(
  options: CreateSaveAutomationDefinitionToolOptions = {},
): ToolDefinition {
  const service = options.saveAutomationDefinitionService ?? saveAutomationDefinition

  return tool({
    description:
      "Save a Pi-compatible automation definition JSON record for the host application to read. Writes locally using filePath, PI_COMPOSIO_AUTOMATIONS_JSON, or ~/.config/pi/composio-automations.json and upserts by triggerId.",
    args: {
      name: tool.schema.string().min(1),
      triggerId: tool.schema.string().min(1),
      triggerSlug: tool.schema.string().min(1),
      instructions: tool.schema.string().min(1),
      enabled: tool.schema.boolean().optional(),
      metadata: jsonRecordSchema.optional(),
      filePath: tool.schema
        .string()
        .min(1)
        .optional()
        .describe(
          "Optional path override for this call. Defaults to PI_COMPOSIO_AUTOMATIONS_JSON or ~/.config/pi/composio-automations.json.",
        ),
    },
    async execute(args, context) {
      try {
        const payload = await service(saveAutomationInput(args), serviceOptions(options, context))
        return formatResult(`Saved automation definition ${args.name}`, payload as unknown as JsonRecord)
      } catch (error) {
        return formatResult("Save automation definition failed", toToolErrorPayload(error) as unknown as JsonRecord)
      }
    },
  })
}
