import { tool, type ToolDefinition } from "@opencode-ai/plugin"

import { getAnonymousUserDataPath, readAnonymousUserData } from "../auth/anonymous-user-data"
import { redactSecrets } from "../auth/redact"
import { resolveComposioAuth, type ResolveComposioAuthOptions } from "../auth/resolve-auth"
import { COMPOSIO_TOOL_NAMES } from "../plugin/manifest"
import { PACKAGE_NAME, PACKAGE_VERSION } from "../shared/version"

export type CreateDebugInfoToolOptions = ResolveComposioAuthOptions

type DebugInfoPayload = {
  packageName: typeof PACKAGE_NAME
  packageVersion: typeof PACKAGE_VERSION
  auth: {
    source: "env" | "anonymous" | null
    apiKeyPresent: boolean
    envKeyPrecedence: boolean
    anonymousDataPath: string
    anonymousDataPresent: boolean
  }
  handoff: {
    tool: "composio_claim"
    command: "/composio-claim <email>"
    anonymousIdentityPresent: boolean
  }
  registeredTools: typeof COMPOSIO_TOOL_NAMES
  redaction: {
    enabled: true
    secretValuesPrinted: false
  }
}

function formatDebugInfo(payload: DebugInfoPayload) {
  return {
    title: "Composio debug info",
    output: JSON.stringify(payload, null, 2),
    metadata: payload,
  }
}

export function createDebugInfoTool(options: CreateDebugInfoToolOptions = {}): ToolDefinition {
  return tool({
    description:
      "Show redacted composio-x-opencode runtime, auth-source, handoff, and registered-tool diagnostics without contacting Composio.",
    args: {},
    async execute() {
      const auth = await resolveComposioAuth(options)
      const anonymousData = await readAnonymousUserData(
        options.home === undefined ? {} : { home: options.home },
      )
      const payload: DebugInfoPayload = {
        packageName: PACKAGE_NAME,
        packageVersion: PACKAGE_VERSION,
        auth: {
          source: auth.source,
          apiKeyPresent: auth.debug.apiKeyPresent,
          envKeyPrecedence: auth.debug.envKeyPrecedence,
          anonymousDataPath: getAnonymousUserDataPath(options.home),
          anonymousDataPresent: auth.debug.anonymousDataPresent,
        },
        handoff: {
          tool: "composio_claim",
          command: "/composio-claim <email>",
          anonymousIdentityPresent: Boolean(anonymousData?.agent_key),
        },
        registeredTools: COMPOSIO_TOOL_NAMES,
        redaction: {
          enabled: true,
          secretValuesPrinted: false,
        },
      }

      return formatDebugInfo(redactSecrets(payload, auth.apiKey ? [auth.apiKey] : []) as DebugInfoPayload)
    },
  })
}
