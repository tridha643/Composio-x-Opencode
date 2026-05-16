import { tool } from "@opencode-ai/plugin"

import { ensureAnonymousIdentity, type EnsureAnonymousIdentityOptions } from "../auth/signup-flow"
import { toToolErrorPayload } from "../auth/errors"

type SignupService = (options: EnsureAnonymousIdentityOptions) => ReturnType<typeof ensureAnonymousIdentity>

export type CreateSignupToolOptions = EnsureAnonymousIdentityOptions & {
  service?: SignupService
}

function formatResult(title: string, payload: Record<string, unknown>) {
  return {
    title,
    output: JSON.stringify(payload, null, 2),
    metadata: payload,
  }
}

export function createSignupTool(options: CreateSignupToolOptions = {}) {
  const service = options.service ?? ensureAnonymousIdentity

  return tool({
    description:
      "Provision or reuse anonymous Composio credentials via the official agent signup flow. Returns a redacted summary only.",
    args: {
      wait: tool.schema.boolean().optional(),
    },
    async execute(args) {
      try {
        const summary = await service({
          home: options.home,
          fetchImpl: options.fetchImpl,
          baseUrl: options.baseUrl,
          wait: args.wait,
        })

        return formatResult(summary.reused ? "Composio signup reused" : "Composio signup complete", summary)
      } catch (error) {
        return formatResult("Composio signup failed", toToolErrorPayload(error) as unknown as Record<string, unknown>)
      }
    },
  })
}
