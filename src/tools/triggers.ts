import { tool, type ToolDefinition } from "@opencode-ai/plugin"

import { UserFacingError, toToolErrorPayload } from "../auth/errors"
import {
  createTrigger,
  deleteTrigger,
  disableTrigger,
  enableTrigger,
  getTriggerTypeSchema,
  listTriggerTypes,
  listTriggers,
  type CreateTriggerInput,
  type DeleteTriggerInput,
  type GetTriggerTypeSchemaInput,
  type ListTriggerTypesInput,
  type ListTriggersInput,
  type ManageTriggerInput,
  type TriggerServiceOptions,
} from "../composio/triggers"

type JsonRecord = Record<string, unknown>

type TriggerService<Input> = (input: Input, options: TriggerServiceOptions) => Promise<JsonRecord>

export type CreateTriggerToolOptions = TriggerServiceOptions & {
  listTriggerTypesService?: TriggerService<ListTriggerTypesInput>
  getTriggerTypeSchemaService?: TriggerService<GetTriggerTypeSchemaInput>
  createTriggerService?: TriggerService<CreateTriggerInput>
  listTriggersService?: TriggerService<ListTriggersInput>
  enableTriggerService?: TriggerService<ManageTriggerInput>
  disableTriggerService?: TriggerService<ManageTriggerInput>
  deleteTriggerService?: TriggerService<DeleteTriggerInput>
}

const jsonRecordSchema = tool.schema.record(tool.schema.string(), tool.schema.unknown())
const stringArraySchema = tool.schema.array(tool.schema.string().min(1))
const toolkitVersionsSchema = tool.schema.union([tool.schema.string().min(1), tool.schema.record(tool.schema.string(), tool.schema.string().min(1))])

function formatResult(title: string, payload: JsonRecord) {
  return {
    title,
    output: JSON.stringify(payload, null, 2),
    metadata: payload,
  }
}

function serviceOptions(options: CreateTriggerToolOptions): TriggerServiceOptions {
  const output: TriggerServiceOptions = {}
  if (options.env !== undefined) output.env = options.env
  if (options.home !== undefined) output.home = options.home
  if (options.fetchImpl !== undefined) output.fetchImpl = options.fetchImpl
  if (options.baseUrl !== undefined) output.baseUrl = options.baseUrl
  return output
}

function listTriggerTypesInput(args: {
  toolkit_slugs?: readonly string[] | undefined
  toolkit_versions?: ListTriggerTypesInput["toolkitVersions"]
  limit?: number | undefined
  cursor?: string | undefined
}): ListTriggerTypesInput {
  const input: ListTriggerTypesInput = {}
  if (args.toolkit_slugs !== undefined) input.toolkitSlugs = args.toolkit_slugs
  if (args.toolkit_versions !== undefined) input.toolkitVersions = args.toolkit_versions
  if (args.limit !== undefined) input.limit = args.limit
  if (args.cursor !== undefined) input.cursor = args.cursor
  return input
}

function getTriggerTypeSchemaInput(args: {
  slug: string
  toolkit_versions?: GetTriggerTypeSchemaInput["toolkitVersions"]
}): GetTriggerTypeSchemaInput {
  const input: GetTriggerTypeSchemaInput = { slug: args.slug }
  if (args.toolkit_versions !== undefined) input.toolkitVersions = args.toolkit_versions
  return input
}

function createTriggerInput(args: {
  slug: string
  trigger_config: JsonRecord
  connected_account_id?: string | undefined
  toolkit_versions?: CreateTriggerInput["toolkitVersions"]
}): CreateTriggerInput {
  const input: CreateTriggerInput = { slug: args.slug, triggerConfig: args.trigger_config }
  if (args.connected_account_id !== undefined) input.connectedAccountId = args.connected_account_id
  if (args.toolkit_versions !== undefined) input.toolkitVersions = args.toolkit_versions
  return input
}

function listTriggersInput(args: {
  user_ids?: readonly string[] | undefined
  connected_account_ids?: readonly string[] | undefined
  auth_config_ids?: readonly string[] | undefined
  trigger_ids?: readonly string[] | undefined
  trigger_names?: readonly string[] | undefined
  show_disabled?: boolean | undefined
  limit?: number | undefined
  cursor?: string | undefined
}): ListTriggersInput {
  const input: ListTriggersInput = {}
  if (args.user_ids !== undefined) input.userIds = args.user_ids
  if (args.connected_account_ids !== undefined) input.connectedAccountIds = args.connected_account_ids
  if (args.auth_config_ids !== undefined) input.authConfigIds = args.auth_config_ids
  if (args.trigger_ids !== undefined) input.triggerIds = args.trigger_ids
  if (args.trigger_names !== undefined) input.triggerNames = args.trigger_names
  if (args.show_disabled !== undefined) input.showDisabled = args.show_disabled
  if (args.limit !== undefined) input.limit = args.limit
  if (args.cursor !== undefined) input.cursor = args.cursor
  return input
}

async function executeTriggerTool<Input>(
  title: string,
  failureTitle: string,
  input: Input,
  service: TriggerService<Input>,
  options: CreateTriggerToolOptions,
) {
  try {
    const payload = await service(input, serviceOptions(options))
    return formatResult(title, payload)
  } catch (error) {
    return formatResult(failureTitle, toToolErrorPayload(error) as unknown as JsonRecord)
  }
}

export function createListTriggerTypesTool(options: CreateTriggerToolOptions = {}): ToolDefinition {
  const service = options.listTriggerTypesService ?? listTriggerTypes

  return tool({
    description:
      "List Composio trigger types for schema-first trigger authoring. Filter by toolkit slugs and optional toolkit_versions; does not create or mutate triggers.",
    args: {
      toolkit_slugs: stringArraySchema.optional(),
      toolkit_versions: toolkitVersionsSchema.optional(),
      limit: tool.schema.number().optional(),
      cursor: tool.schema.string().optional(),
    },
    async execute(args) {
      return executeTriggerTool(
        "Composio trigger types",
        "Composio trigger type listing failed",
        listTriggerTypesInput(args),
        service,
        options,
      )
    },
  })
}

export function createGetTriggerTypeSchemaTool(options: CreateTriggerToolOptions = {}): ToolDefinition {
  const service = options.getTriggerTypeSchemaService ?? getTriggerTypeSchema

  return tool({
    description:
      "Fetch the exact Composio trigger type schema/config before creating a trigger. Never guess trigger slugs or trigger_config fields.",
    args: {
      slug: tool.schema.string().min(1),
      toolkit_versions: toolkitVersionsSchema.optional(),
    },
    async execute(args) {
      return executeTriggerTool(
        "Composio trigger type schema",
        "Composio trigger type schema failed",
        getTriggerTypeSchemaInput(args),
        service,
        options,
      )
    },
  })
}

export function createCreateTriggerTool(options: CreateTriggerToolOptions = {}): ToolDefinition {
  const service = options.createTriggerService ?? createTrigger

  return tool({
    description:
      "Create or upsert a Composio trigger instance after schema lookup. May require a connected account; use composio_manage_connections when account auth is missing.",
    args: {
      slug: tool.schema.string().min(1),
      trigger_config: jsonRecordSchema,
      connected_account_id: tool.schema.string().min(1).optional(),
      toolkit_versions: toolkitVersionsSchema.optional(),
    },
    async execute(args) {
      return executeTriggerTool(
        "Composio trigger upsert",
        "Composio trigger upsert failed",
        createTriggerInput(args),
        service,
        options,
      )
    },
  })
}

export function createListTriggersTool(options: CreateTriggerToolOptions = {}): ToolDefinition {
  const service = options.listTriggersService ?? listTriggers

  return tool({
    description:
      "List existing Composio trigger instances, including IDs, slugs/names, status, version, config, and connected-account references before mutation.",
    args: {
      user_ids: stringArraySchema.optional(),
      connected_account_ids: stringArraySchema.optional(),
      auth_config_ids: stringArraySchema.optional(),
      trigger_ids: stringArraySchema.optional(),
      trigger_names: stringArraySchema.optional(),
      show_disabled: tool.schema.boolean().optional(),
      limit: tool.schema.number().optional(),
      cursor: tool.schema.string().optional(),
    },
    async execute(args) {
      return executeTriggerTool(
        "Composio triggers",
        "Composio trigger listing failed",
        listTriggersInput(args),
        service,
        options,
      )
    },
  })
}

export function createEnableTriggerTool(options: CreateTriggerToolOptions = {}): ToolDefinition {
  const service = options.enableTriggerService ?? enableTrigger

  return tool({
    description:
      "Enable one exact Composio trigger instance by trigger_id. This resumes event delivery for an existing trigger and may affect external automations.",
    args: {
      trigger_id: tool.schema.string().min(1),
    },
    async execute(args) {
      return executeTriggerTool(
        "Composio trigger enabled",
        "Composio trigger enable failed",
        { triggerId: args.trigger_id },
        service,
        options,
      )
    },
  })
}

export function createDisableTriggerTool(options: CreateTriggerToolOptions = {}): ToolDefinition {
  const service = options.disableTriggerService ?? disableTrigger

  return tool({
    description:
      "Disable one exact Composio trigger instance by trigger_id. This pauses event delivery without deleting the trigger; use delete only for permanent removal.",
    args: {
      trigger_id: tool.schema.string().min(1),
    },
    async execute(args) {
      return executeTriggerTool(
        "Composio trigger disabled",
        "Composio trigger disable failed",
        { triggerId: args.trigger_id },
        service,
        options,
      )
    },
  })
}

export function createDeleteTriggerTool(options: CreateTriggerToolOptions = {}): ToolDefinition {
  const service = options.deleteTriggerService ?? deleteTrigger

  return tool({
    description:
      "Permanently delete one exact Composio trigger instance by trigger_id. Destructive and irreversible; requires confirm: true.",
    args: {
      trigger_id: tool.schema.string().min(1),
      confirm: tool.schema.boolean(),
    },
    async execute(args) {
      if (args.confirm !== true) {
        return formatResult(
          "Composio trigger delete blocked",
          toToolErrorPayload(
            new UserFacingError(
              "TRIGGER_DELETE_CONFIRMATION_REQUIRED",
              "composio_delete_trigger permanently deletes a trigger. Re-run with confirm: true and the exact trigger_id after listing triggers.",
              { triggerId: args.trigger_id, destructive: true },
            ),
          ) as unknown as JsonRecord,
        )
      }

      return executeTriggerTool(
        "Composio trigger deleted",
        "Composio trigger delete failed",
        { triggerId: args.trigger_id },
        service,
        options,
      )
    },
  })
}
