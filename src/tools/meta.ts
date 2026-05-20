import { tool, type ToolContext, type ToolDefinition } from "@opencode-ai/plugin"

import { toToolErrorPayload } from "../auth/errors"
import { normalizeConnectionGuidance, renderConnectionGuidance } from "../composio/connection-guidance"
import { executeMetaTool, type MetaToolSlug, type ToolRouterOptions } from "../composio/tool-router"

type MetaToolName =
  | "composio_search_tools"
  | "composio_get_tool_schemas"
  | "composio_manage_connections"
  | "composio_multi_execute_tool"
  | "composio_remote_bash_tool"
  | "composio_remote_workbench"

export type CreateMetaToolOptions = ToolRouterOptions

const jsonRecordSchema = tool.schema.record(tool.schema.string(), tool.schema.unknown())

function formatResult(title: string, payload: Record<string, unknown>) {
  return {
    title,
    output: JSON.stringify(payload, null, 2),
    metadata: payload,
  }
}

function formatMetaResult(
  title: string,
  toolName: MetaToolName,
  payload: Record<string, unknown>,
  connectionOptions?: { requestedToolkits?: readonly string[]; toolSlugs?: readonly string[] },
) {
  const guidance = connectionOptions === undefined ? null : normalizeConnectionGuidance(payload, connectionOptions)
  if (guidance === null) return formatResult(title, payload)

  const metadata = {
    ...payload,
    upstreamOk: payload.ok,
    ...guidance,
  }

  return {
    title: "Composio connection required",
    output: renderConnectionGuidance(guidance, toolName),
    metadata,
  }
}

function withOptionalString(output: Record<string, unknown>, key: string, value: string | undefined): void {
  if (value !== undefined) output[key] = value
}

async function executeAndFormat(
  toolName: MetaToolName,
  upstreamSlug: MetaToolSlug,
  upstreamArguments: Record<string, unknown>,
  args: { user_id?: string | undefined },
  context: ToolContext,
  options: CreateMetaToolOptions,
  risk?: string,
  connectionOptions?: { requestedToolkits?: readonly string[]; toolSlugs?: readonly string[] },
) {
  try {
    const input = {
      slug: upstreamSlug,
      arguments: upstreamArguments,
    } as Parameters<typeof executeMetaTool>[0]

    if (args.user_id !== undefined) input.userId = args.user_id
    if (risk !== undefined) input.risk = risk

    const payload = await executeMetaTool(input, context, options)

    return formatMetaResult(`Composio ${toolName}`, toolName, { tool: toolName, ...payload }, connectionOptions)
  } catch (error) {
    return formatMetaResult(
      `Composio ${toolName} failed`,
      toolName,
      toToolErrorPayload(error) as unknown as Record<string, unknown>,
      connectionOptions,
    )
  }
}

export function createSearchToolsTool(options: CreateMetaToolOptions = {}): ToolDefinition {
  return tool({
    description:
      "Search Composio's tool catalog for a use case, returning matching tool slugs, schemas, connection status, and execution guidance. Use this before executing unknown Composio tools.",
    args: {
      queries: tool.schema.array(
        tool.schema.object({
          use_case: tool.schema.string().min(1),
          known_fields: tool.schema.string().optional(),
        }),
      ),
      session: tool.schema
        .object({
          id: tool.schema.string().optional(),
          generate_id: tool.schema.boolean().optional(),
        })
        .optional(),
      model: tool.schema.string().optional(),
      user_id: tool.schema.string().optional(),
    },
    async execute(args, context) {
      const upstreamArguments: Record<string, unknown> = { queries: args.queries }
      if (args.session !== undefined) upstreamArguments.session = args.session
      withOptionalString(upstreamArguments, "model", args.model)

      return executeAndFormat(
        "composio_search_tools",
        "COMPOSIO_SEARCH_TOOLS",
        upstreamArguments,
        args,
        context,
        options,
      )
    },
  })
}

export function createGetToolSchemasTool(options: CreateMetaToolOptions = {}): ToolDefinition {
  return tool({
    description:
      "Fetch exact Composio input/output schemas for known tool slugs. Never invent slugs; call composio_search_tools first when unsure.",
    args: {
      tool_slugs: tool.schema.array(tool.schema.string().min(1)),
      include: tool.schema.array(tool.schema.string()).optional(),
      session_id: tool.schema.string().optional(),
      user_id: tool.schema.string().optional(),
    },
    async execute(args, context) {
      const upstreamArguments: Record<string, unknown> = { tool_slugs: args.tool_slugs }
      if (args.include !== undefined) upstreamArguments.include = args.include
      withOptionalString(upstreamArguments, "session_id", args.session_id)

      return executeAndFormat(
        "composio_get_tool_schemas",
        "COMPOSIO_GET_TOOL_SCHEMAS",
        upstreamArguments,
        args,
        context,
        options,
      )
    },
  })
}

export function createManageConnectionsTool(options: CreateMetaToolOptions = {}): ToolDefinition {
  return tool({
    description:
      "Inspect or initiate Composio connected-account authentication flows for toolkits. May create OAuth/API-key auth links or reinitiate existing connections.",
    args: {
      toolkits: tool.schema.array(tool.schema.string().min(1)),
      reinitiate_all: tool.schema.boolean().optional(),
      session_id: tool.schema.string().optional(),
      user_id: tool.schema.string().optional(),
    },
    async execute(args, context) {
      const upstreamArguments: Record<string, unknown> = { toolkits: args.toolkits }
      if (args.reinitiate_all !== undefined) upstreamArguments.reinitiate_all = args.reinitiate_all
      withOptionalString(upstreamArguments, "session_id", args.session_id)

      return executeAndFormat(
        "composio_manage_connections",
        "COMPOSIO_MANAGE_CONNECTIONS",
        upstreamArguments,
        args,
        context,
        options,
        "auth_state_change",
        { requestedToolkits: args.toolkits },
      )
    },
  })
}

export function createMultiExecuteTool(options: CreateMetaToolOptions = {}): ToolDefinition {
  return tool({
    description:
      "Execute one or more third-party Composio app tools. This can mutate external services; inspect schemas and connection status before calling.",
    args: {
      tools: tool.schema.array(
        tool.schema.object({
          tool_slug: tool.schema.string().min(1),
          arguments: jsonRecordSchema,
        }),
      ),
      sync_response_to_workbench: tool.schema.boolean().optional(),
      thought: tool.schema.string().optional(),
      current_step: tool.schema.string().optional(),
      current_step_metric: tool.schema.string().optional(),
      session_id: tool.schema.string().optional(),
      user_id: tool.schema.string().optional(),
    },
    async execute(args, context) {
      const upstreamArguments: Record<string, unknown> = {
        tools: args.tools,
        sync_response_to_workbench: args.sync_response_to_workbench ?? false,
      }
      withOptionalString(upstreamArguments, "thought", args.thought)
      withOptionalString(upstreamArguments, "current_step", args.current_step)
      withOptionalString(upstreamArguments, "current_step_metric", args.current_step_metric)
      withOptionalString(upstreamArguments, "session_id", args.session_id)

      return executeAndFormat(
        "composio_multi_execute_tool",
        "COMPOSIO_MULTI_EXECUTE_TOOL",
        upstreamArguments,
        args,
        context,
        options,
        "open_world_external_mutation",
        { toolSlugs: args.tools.map((entry) => entry.tool_slug) },
      )
    },
  })
}

export function createRemoteBashTool(options: CreateMetaToolOptions = {}): ToolDefinition {
  return tool({
    description:
      "Run a bash command in Composio's remote sandbox, not the local machine. This is open-world remote code execution and can affect remote files or services.",
    args: {
      command: tool.schema.string().min(1),
      session_id: tool.schema.string().optional(),
      user_id: tool.schema.string().optional(),
    },
    async execute(args, context) {
      const upstreamArguments: Record<string, unknown> = { command: args.command }
      withOptionalString(upstreamArguments, "session_id", args.session_id)

      return executeAndFormat(
        "composio_remote_bash_tool",
        "COMPOSIO_REMOTE_BASH_TOOL",
        upstreamArguments,
        args,
        context,
        options,
        "remote_code_execution",
      )
    },
  })
}

export function createRemoteWorkbenchTool(options: CreateMetaToolOptions = {}): ToolDefinition {
  return tool({
    description:
      "Run Python in Composio's persistent remote workbench sandbox, not locally. This is open-world remote code execution for processing large or stateful results.",
    args: {
      code_to_execute: tool.schema.string().min(1),
      thought: tool.schema.string().optional(),
      current_step: tool.schema.string().optional(),
      current_step_metric: tool.schema.string().optional(),
      session_id: tool.schema.string().optional(),
      user_id: tool.schema.string().optional(),
    },
    async execute(args, context) {
      const upstreamArguments: Record<string, unknown> = { code_to_execute: args.code_to_execute }
      withOptionalString(upstreamArguments, "thought", args.thought)
      withOptionalString(upstreamArguments, "current_step", args.current_step)
      withOptionalString(upstreamArguments, "current_step_metric", args.current_step_metric)
      withOptionalString(upstreamArguments, "session_id", args.session_id)

      return executeAndFormat(
        "composio_remote_workbench",
        "COMPOSIO_REMOTE_WORKBENCH",
        upstreamArguments,
        args,
        context,
        options,
        "remote_code_execution",
      )
    },
  })
}
