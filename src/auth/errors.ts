import { redactSecrets, redactString } from "./redact"

export type ToolErrorPayload = {
  ok: false
  code: string
  message: string
  details?: unknown
}

export class UserFacingError extends Error {
  readonly code: string
  readonly details?: unknown

  constructor(code: string, message: string, details?: unknown) {
    super(redactString(message))
    this.name = "UserFacingError"
    this.code = code
    if (details !== undefined) {
      this.details = redactSecrets(details)
    }
  }
}

export function toToolErrorPayload(error: unknown, knownSecrets: readonly string[] = []): ToolErrorPayload {
  if (error instanceof UserFacingError) {
    const payload: ToolErrorPayload = {
      ok: false,
      code: error.code,
      message: redactString(error.message, knownSecrets),
    }
    if (error.details !== undefined) {
      payload.details = redactSecrets(error.details, knownSecrets)
    }
    return payload
  }

  if (error instanceof Error) {
    return {
      ok: false,
      code: "UNKNOWN_ERROR",
      message: redactString(error.message || "Unexpected error", knownSecrets),
    }
  }

  return {
    ok: false,
    code: "UNKNOWN_ERROR",
    message: "Unexpected error",
    details: redactSecrets(error, knownSecrets),
  }
}
