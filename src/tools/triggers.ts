import { tool, type ToolContext, type ToolDefinition } from "@opencode-ai/plugin"

import { toToolErrorPayload } from "../auth/errors"
import { type QueryValue } from "../composio/client"
import { type AuthenticatedComposioRuntime, type ComposioSessionManager } from "../composio/session-manager"
import { formatToolResult } from "./format"

const toolkitVersionsSchema = tool.schema.union([tool.schema.string(), tool.schema.record(tool.schema.string(), tool.schema.unknown())])

type TriggerRuntime = AuthenticatedComposioRuntime

async function getRuntime(manager: ComposioSessionManager, context: ToolContext): Promise<TriggerRuntime> {
  return manager.getAuthenticatedRuntime({}, context)
}

function errorResult(title: string, error: unknown) {
  return formatToolResult(title, toToolErrorPayload(error) as unknown as Record<string, unknown>)
}

function queryFromFilters(filters: Record<string, QueryValue>): Record<string, QueryValue> {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined)) as Record<string, QueryValue>
}

async function triggerRequest(
  runtime: TriggerRuntime,
  method: string,
  path: string,
  title: string,
  context: ToolContext,
  options: { query?: Record<string, QueryValue>; body?: unknown } = {},
) {
  const requestOptions: Parameters<TriggerRuntime["client"]["request"]>[2] = {}
  if (options.query !== undefined) requestOptions.query = options.query
  if (options.body !== undefined) requestOptions.body = options.body
  requestOptions.signal = context.abort
  const response = await runtime.client.request(method, path, requestOptions)

  return formatToolResult(title, {
    ok: true,
    userId: runtime.userId,
    authSource: runtime.authSource,
    response,
  }, [runtime.client.apiKey])
}

export function createListTriggerTypesTool(manager: ComposioSessionManager): ToolDefinition {
  return tool({
    description: "List Composio trigger types, optionally filtered by toolkit.",
    args: {
      toolkit_slugs: tool.schema.array(tool.schema.string()).optional(),
      toolkit_versions: toolkitVersionsSchema.optional(),
      limit: tool.schema.number().int().positive().max(1000).optional(),
      cursor: tool.schema.string().optional(),
      enums_only: tool.schema.boolean().optional(),
    },
    async execute(args, context) {
      try {
        const runtime = await getRuntime(manager, context)
        const path = args.enums_only ? "triggers_types/list/enum" : "triggers_types"

        return await triggerRequest(runtime, "GET", path, "Composio trigger types", context, {
          query: queryFromFilters({
            toolkit_slugs: args.toolkit_slugs,
            toolkit_versions: args.toolkit_versions ?? "latest",
            limit: args.limit,
            cursor: args.cursor,
          }),
        })
      } catch (error) {
        return errorResult("Composio trigger type list failed", error)
      }
    },
  })
}

export function createGetTriggerTypeSchemaTool(manager: ComposioSessionManager): ToolDefinition {
  return tool({
    description: "Get the schema for one Composio trigger type.",
    args: {
      slug: tool.schema.string(),
      toolkit_versions: toolkitVersionsSchema.optional(),
    },
    async execute(args, context) {
      try {
        const runtime = await getRuntime(manager, context)

        return await triggerRequest(
          runtime,
          "GET",
          `triggers_types/${encodeURIComponent(args.slug)}`,
          "Composio trigger type schema",
          context,
          { query: queryFromFilters({ toolkit_versions: args.toolkit_versions ?? "latest" }) },
        )
      } catch (error) {
        return errorResult("Composio trigger type schema failed", error)
      }
    },
  })
}

export function createListTriggersTool(manager: ComposioSessionManager): ToolDefinition {
  return tool({
    description: "List active Composio trigger instances, optionally including disabled triggers.",
    args: {
      user_ids: tool.schema.array(tool.schema.string()).optional(),
      connected_account_ids: tool.schema.array(tool.schema.string()).optional(),
      auth_config_ids: tool.schema.array(tool.schema.string()).optional(),
      trigger_ids: tool.schema.array(tool.schema.string()).optional(),
      trigger_names: tool.schema.array(tool.schema.string()).optional(),
      show_disabled: tool.schema.boolean().optional(),
      limit: tool.schema.number().int().positive().max(1000).optional(),
      cursor: tool.schema.string().optional(),
    },
    async execute(args, context) {
      try {
        const runtime = await getRuntime(manager, context)

        return await triggerRequest(runtime, "GET", "trigger_instances/active", "Composio triggers", context, {
          query: queryFromFilters(args),
        })
      } catch (error) {
        return errorResult("Composio trigger list failed", error)
      }
    },
  })
}

export function createCreateTriggerTool(manager: ComposioSessionManager): ToolDefinition {
  return tool({
    description: "Create or update a Composio trigger instance. Requires confirm_create=true.",
    args: {
      slug: tool.schema.string(),
      connected_account_id: tool.schema.string(),
      trigger_config: tool.schema.record(tool.schema.string(), tool.schema.unknown()).optional(),
      toolkit_versions: toolkitVersionsSchema.optional(),
      confirm_create: tool.schema.boolean(),
    },
    async execute(args, context) {
      try {
        if (!args.confirm_create) {
          return formatToolResult("Composio trigger create blocked", {
            ok: false,
            code: "TRIGGER_CREATE_NOT_CONFIRMED",
            message: "Set confirm_create=true to create or update a Composio trigger.",
          })
        }

        const runtime = await getRuntime(manager, context)

        return await triggerRequest(
          runtime,
          "POST",
          `trigger_instances/${encodeURIComponent(args.slug)}/upsert`,
          "Composio trigger upserted",
          context,
          {
            body: {
              connected_account_id: args.connected_account_id,
              trigger_config: args.trigger_config ?? {},
              toolkit_versions: args.toolkit_versions ?? "latest",
            },
          },
        )
      } catch (error) {
        return errorResult("Composio trigger create failed", error)
      }
    },
  })
}

function createTriggerStatusTool(manager: ComposioSessionManager, status: "enable" | "disable"): ToolDefinition {
  return tool({
    description: `${status === "enable" ? "Enable" : "Disable"} a Composio trigger instance. Requires confirm_${status}=true.`,
    args: status === "enable"
      ? {
        trigger_id: tool.schema.string(),
        confirm_enable: tool.schema.boolean(),
      }
      : {
        trigger_id: tool.schema.string(),
        confirm_disable: tool.schema.boolean(),
      },
    async execute(args, context) {
      try {
        const confirmed = status === "enable" ? args.confirm_enable === true : args.confirm_disable === true
        if (!confirmed) {
          return formatToolResult(`Composio trigger ${status} blocked`, {
            ok: false,
            code: `TRIGGER_${status.toUpperCase()}_NOT_CONFIRMED`,
            message: `Set confirm_${status}=true to ${status} this Composio trigger.`,
          })
        }

        const runtime = await getRuntime(manager, context)

        return await triggerRequest(
          runtime,
          "PATCH",
          `trigger_instances/manage/${encodeURIComponent(args.trigger_id)}`,
          `Composio trigger ${status}d`,
          context,
          { body: { status } },
        )
      } catch (error) {
        return errorResult(`Composio trigger ${status} failed`, error)
      }
    },
  })
}

export function createEnableTriggerTool(manager: ComposioSessionManager): ToolDefinition {
  return createTriggerStatusTool(manager, "enable")
}

export function createDisableTriggerTool(manager: ComposioSessionManager): ToolDefinition {
  return createTriggerStatusTool(manager, "disable")
}

export function createDeleteTriggerTool(manager: ComposioSessionManager): ToolDefinition {
  return tool({
    description: "Delete a Composio trigger instance permanently. Requires confirm_delete=true.",
    args: {
      trigger_id: tool.schema.string(),
      confirm_delete: tool.schema.boolean(),
    },
    async execute(args, context) {
      try {
        if (!args.confirm_delete) {
          return formatToolResult("Composio trigger delete blocked", {
            ok: false,
            code: "TRIGGER_DELETE_NOT_CONFIRMED",
            message: "Set confirm_delete=true to permanently delete this Composio trigger.",
          })
        }

        const runtime = await getRuntime(manager, context)

        return await triggerRequest(
          runtime,
          "DELETE",
          `trigger_instances/manage/${encodeURIComponent(args.trigger_id)}`,
          "Composio trigger deleted",
          context,
        )
      } catch (error) {
        return errorResult("Composio trigger delete failed", error)
      }
    },
  })
}
