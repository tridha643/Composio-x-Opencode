import { tool, type ToolDefinition } from "@opencode-ai/plugin"

import { claimAnonymousIdentity, type ClaimAnonymousIdentityOptions } from "../auth/claim-flow"
import { ensureAnonymousIdentity, type EnsureAnonymousIdentityOptions } from "../auth/signup-flow"
import { toToolErrorPayload } from "../auth/errors"

type SignupService = (options: EnsureAnonymousIdentityOptions) => ReturnType<typeof ensureAnonymousIdentity>
type ClaimService = (options: ClaimAnonymousIdentityOptions) => ReturnType<typeof claimAnonymousIdentity>

export type CreateSignupToolOptions = EnsureAnonymousIdentityOptions & {
  service?: SignupService
}

export type CreateClaimToolOptions = Omit<ClaimAnonymousIdentityOptions, "email"> & {
  service?: ClaimService
}

function formatResult(title: string, payload: Record<string, unknown>) {
  return {
    title,
    output: JSON.stringify(payload, null, 2),
    metadata: payload,
  }
}

function serviceOptions(options: CreateSignupToolOptions, wait: boolean | undefined): EnsureAnonymousIdentityOptions {
  const output: EnsureAnonymousIdentityOptions = {}
  if (options.home !== undefined) output.home = options.home
  if (options.fetchImpl !== undefined) output.fetchImpl = options.fetchImpl
  if (options.baseUrl !== undefined) output.baseUrl = options.baseUrl
  if (wait !== undefined) output.wait = wait
  return output
}

function claimServiceOptions(options: CreateClaimToolOptions, email: string): ClaimAnonymousIdentityOptions {
  const output: ClaimAnonymousIdentityOptions = { email }
  if (options.home !== undefined) output.home = options.home
  if (options.fetchImpl !== undefined) output.fetchImpl = options.fetchImpl
  if (options.baseUrl !== undefined) output.baseUrl = options.baseUrl
  return output
}

export function createSignupTool(options: CreateSignupToolOptions = {}): ToolDefinition {
  const service = options.service ?? ensureAnonymousIdentity

  return tool({
    description:
      "Provision or reuse anonymous Composio credentials via the official agent signup flow. Returns a redacted summary only.",
    args: {
      wait: tool.schema.boolean().optional(),
    },
    async execute(args) {
      try {
        const summary = await service(serviceOptions(options, args.wait))

        return formatResult(summary.reused ? "Composio signup reused" : "Composio signup complete", summary)
      } catch (error) {
        return formatResult("Composio signup failed", toToolErrorPayload(error) as unknown as Record<string, unknown>)
      }
    },
  })
}

export function createClaimTool(options: CreateClaimToolOptions = {}): ToolDefinition {
  const service = options.service ?? claimAnonymousIdentity

  return tool({
    description:
      "Request handoff of the anonymous Composio organization to a human email. Returns invite status and next steps without secrets.",
    args: {
      email: tool.schema.string(),
    },
    async execute(args) {
      try {
        const summary = await service(claimServiceOptions(options, args.email))

        return formatResult(`Composio claim ${summary.status}`, summary)
      } catch (error) {
        return formatResult("Composio claim failed", toToolErrorPayload(error) as unknown as Record<string, unknown>)
      }
    },
  })
}
