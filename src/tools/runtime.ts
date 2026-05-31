import { tool, type ToolContext, type ToolDefinition } from "@opencode-ai/plugin"

import { toToolErrorPayload } from "../auth/errors"
import { type ComposioSessionManager, type RuntimeSessionArgs } from "../composio/session-manager"
import { formatToolResult } from "./format"

type MetaToolSlug =
  | "COMPOSIO_SEARCH_TOOLS"
  | "COMPOSIO_GET_TOOL_SCHEMAS"
  | "COMPOSIO_MANAGE_CONNECTIONS"
  | "COMPOSIO_MULTI_EXECUTE_TOOL"
  | "COMPOSIO_REMOTE_BASH_TOOL"
  | "COMPOSIO_REMOTE_WORKBENCH"

const sessionArgs = {
  session_id: tool.schema.string().optional(),
  user_id: tool.schema.string().optional(),
  session_toolkits: tool.schema.array(tool.schema.string()).optional(),
  toolkit_versions: tool.schema.union([tool.schema.string(), tool.schema.record(tool.schema.string(), tool.schema.unknown())]).optional(),
  auth_configs: tool.schema.record(tool.schema.string(), tool.schema.string()).optional(),
  connected_accounts: tool.schema.record(tool.schema.string(), tool.schema.array(tool.schema.string())).optional(),
}

type ToolSessionArgs = {
  session_id?: string | undefined
  user_id?: string | undefined
  session_toolkits?: string[] | undefined
  toolkit_versions?: string | Record<string, unknown> | undefined
  auth_configs?: Record<string, string> | undefined
  connected_accounts?: Record<string, string[]> | undefined
}

const querySchema = tool.schema.union([
  tool.schema.string(),
  tool.schema.object({
    query: tool.schema.string(),
    toolkit: tool.schema.string().optional(),
  }).passthrough(),
])

function runtimeSessionArgs(args: ToolSessionArgs): RuntimeSessionArgs {
  const output: RuntimeSessionArgs = {}
  if (args.session_id !== undefined) output.session_id = args.session_id
  if (args.user_id !== undefined) output.user_id = args.user_id
  if (args.session_toolkits !== undefined) output.toolkits = args.session_toolkits
  if (args.toolkit_versions !== undefined) output.toolkit_versions = args.toolkit_versions
  if (args.auth_configs !== undefined) output.auth_configs = args.auth_configs
  if (args.connected_accounts !== undefined) output.connected_accounts = args.connected_accounts
  return output
}

function withSessionId(argumentsPayload: Record<string, unknown>, sessionId: string): Record<string, unknown> {
  return {
    ...argumentsPayload,
    session_id: sessionId,
  }
}

async function executeMetaTool(
  manager: ComposioSessionManager,
  toolSlug: MetaToolSlug,
  args: ToolSessionArgs,
  argumentsPayload: Record<string, unknown>,
  context: ToolContext,
) {
  const session = await manager.getRuntimeSession(runtimeSessionArgs(args), context)
  const response = await session.client.request("POST", `tool_router/session/${encodeURIComponent(session.sessionId)}/execute`, {
    body: {
      tool_slug: toolSlug,
      arguments: withSessionId(argumentsPayload, session.sessionId),
    },
    signal: context.abort,
  })

  return formatToolResult(`${toolSlug} complete`, {
    ok: true,
    sessionId: session.sessionId,
    userId: session.userId,
    authSource: session.authSource,
    reusedSession: session.reused,
    response,
  }, [session.client.apiKey])
}

function errorResult(title: string, error: unknown, apiKey?: string) {
  return formatToolResult(title, toToolErrorPayload(error, apiKey ? [apiKey] : []) as unknown as Record<string, unknown>, apiKey ? [apiKey] : [])
}

export function createSearchToolsTool(manager: ComposioSessionManager): ToolDefinition {
  return tool({
    description: "Search Composio's available tools through a Tool Router session.",
    args: {
      queries: tool.schema.array(querySchema).min(1),
      model: tool.schema.string().optional(),
      ...sessionArgs,
    },
    async execute(args, context) {
      try {
        const session = await manager.getRuntimeSession(runtimeSessionArgs(args), context)
        const argumentsPayload: Record<string, unknown> = {
          queries: args.queries,
          session: { id: session.sessionId },
          session_id: session.sessionId,
        }
        if (args.model !== undefined) argumentsPayload.model = args.model

        const response = await session.client.request("POST", `tool_router/session/${encodeURIComponent(session.sessionId)}/execute`, {
          body: {
            tool_slug: "COMPOSIO_SEARCH_TOOLS",
            arguments: argumentsPayload,
          },
          signal: context.abort,
        })

        return formatToolResult("COMPOSIO_SEARCH_TOOLS complete", {
          ok: true,
          sessionId: session.sessionId,
          userId: session.userId,
          authSource: session.authSource,
          reusedSession: session.reused,
          response,
        }, [session.client.apiKey])
      } catch (error) {
        return errorResult("COMPOSIO_SEARCH_TOOLS failed", error)
      }
    },
  })
}

export function createGetToolSchemasTool(manager: ComposioSessionManager): ToolDefinition {
  return tool({
    description: "Fetch Composio tool schemas through a Tool Router session.",
    args: {
      tool_slugs: tool.schema.array(tool.schema.string()).min(1),
      include: tool.schema.array(tool.schema.enum(["input_schema", "output_schema"])).optional(),
      ...sessionArgs,
    },
    async execute(args, context) {
      try {
        return await executeMetaTool(manager, "COMPOSIO_GET_TOOL_SCHEMAS", args, {
          tool_slugs: args.tool_slugs,
          include: args.include ?? ["input_schema"],
        }, context)
      } catch (error) {
        return errorResult("COMPOSIO_GET_TOOL_SCHEMAS failed", error)
      }
    },
  })
}

export function createManageConnectionsTool(manager: ComposioSessionManager): ToolDefinition {
  return tool({
    description: "Inspect or initiate Composio connected-account flows for one or more toolkits.",
    args: {
      toolkits: tool.schema.array(tool.schema.string()).min(1),
      reinitiate_all: tool.schema.boolean().optional(),
      ...sessionArgs,
    },
    async execute(args, context) {
      try {
        return await executeMetaTool(manager, "COMPOSIO_MANAGE_CONNECTIONS", args, {
          toolkits: args.toolkits,
          reinitiate_all: args.reinitiate_all ?? false,
        }, context)
      } catch (error) {
        return errorResult("COMPOSIO_MANAGE_CONNECTIONS failed", error)
      }
    },
  })
}

export function createMultiExecuteTool(manager: ComposioSessionManager): ToolDefinition {
  return tool({
    description: "Execute one or more Composio tools through the Tool Router multi-execute meta tool.",
    args: {
      tools: tool.schema.array(tool.schema.object({
        tool_slug: tool.schema.string(),
        arguments: tool.schema.record(tool.schema.string(), tool.schema.unknown()).optional(),
        account: tool.schema.string().optional(),
      }).passthrough()).min(1),
      thought: tool.schema.string(),
      sync_response_to_workbench: tool.schema.boolean().optional(),
      current_step: tool.schema.string().optional(),
      current_step_metric: tool.schema.string().optional(),
      ...sessionArgs,
    },
    async execute(args, context) {
      try {
        return await executeMetaTool(manager, "COMPOSIO_MULTI_EXECUTE_TOOL", args, {
          tools: args.tools,
          thought: args.thought,
          sync_response_to_workbench: args.sync_response_to_workbench ?? false,
          current_step: args.current_step ?? "EXECUTING_TOOLS",
          current_step_metric: args.current_step_metric ?? `${args.tools.length}/${args.tools.length} tools requested`,
        }, context)
      } catch (error) {
        return errorResult("COMPOSIO_MULTI_EXECUTE_TOOL failed", error)
      }
    },
  })
}

export function createRemoteBashTool(manager: ComposioSessionManager): ToolDefinition {
  return tool({
    description: "Run a command in Composio's remote bash capability. Requires confirm_remote_execution=true.",
    args: {
      command: tool.schema.string(),
      confirm_remote_execution: tool.schema.boolean(),
      ...sessionArgs,
    },
    async execute(args, context) {
      try {
        if (!args.confirm_remote_execution) {
          return formatToolResult("COMPOSIO_REMOTE_BASH_TOOL blocked", {
            ok: false,
            code: "REMOTE_EXECUTION_NOT_CONFIRMED",
            message: "Set confirm_remote_execution=true to run remote bash through Composio.",
          })
        }

        return await executeMetaTool(manager, "COMPOSIO_REMOTE_BASH_TOOL", args, {
          command: args.command,
        }, context)
      } catch (error) {
        return errorResult("COMPOSIO_REMOTE_BASH_TOOL failed", error)
      }
    },
  })
}

export function createRemoteWorkbenchTool(manager: ComposioSessionManager): ToolDefinition {
  return tool({
    description: "Run Python in Composio's persistent remote workbench. Requires confirm_remote_execution=true.",
    args: {
      code_to_execute: tool.schema.string(),
      confirm_remote_execution: tool.schema.boolean(),
      thought: tool.schema.string().optional(),
      current_step: tool.schema.string().optional(),
      current_step_metric: tool.schema.string().optional(),
      ...sessionArgs,
    },
    async execute(args, context) {
      try {
        if (!args.confirm_remote_execution) {
          return formatToolResult("COMPOSIO_REMOTE_WORKBENCH blocked", {
            ok: false,
            code: "REMOTE_EXECUTION_NOT_CONFIRMED",
            message: "Set confirm_remote_execution=true to run remote workbench code through Composio.",
          })
        }

        return await executeMetaTool(manager, "COMPOSIO_REMOTE_WORKBENCH", args, {
          code_to_execute: args.code_to_execute,
          thought: args.thought ?? "Run remote workbench code",
          current_step: args.current_step ?? "RUNNING_WORKBENCH_CODE",
          current_step_metric: args.current_step_metric ?? "1/1 code cells requested",
        }, context)
      } catch (error) {
        return errorResult("COMPOSIO_REMOTE_WORKBENCH failed", error)
      }
    },
  })
}
