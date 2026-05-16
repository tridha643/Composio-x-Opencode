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

function scrubToolErrorDetails(value: unknown, knownSecrets: readonly string[] = []): unknown {
  if (typeof value === "string") return redactString(value, knownSecrets).replace(/authorization/gi, "[REDACTED]")
  if (Array.isArray(value)) return value.map((entry) => scrubToolErrorDetails(entry, knownSecrets))
  if (!value || typeof value !== "object" || value instanceof Error) return redactSecrets(value, knownSecrets)

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) =>
        !/(agent[_-]?key|api[_-]?key|user[_-]?api[_-]?key|invite[_-]?code|authorization|token|secret|password)/i.test(
          key,
        ),
      )
      .map(([key, entry]) => [key, scrubToolErrorDetails(entry, knownSecrets)]),
  )
}

export function toToolErrorPayload(error: unknown, knownSecrets: readonly string[] = []): ToolErrorPayload {
  if (error instanceof UserFacingError) {
    const payload: ToolErrorPayload = {
      ok: false,
      code: error.code,
      message: redactString(error.message, knownSecrets).replace(/authorization/gi, "[REDACTED]"),
    }
    if (error.details !== undefined) {
      payload.details = scrubToolErrorDetails(error.details, knownSecrets)
    }
    return payload
  }

  if (error instanceof Error) {
    return {
      ok: false,
      code: "UNKNOWN_ERROR",
      message: redactString(error.message || "Unexpected error", knownSecrets).replace(/authorization/gi, "[REDACTED]"),
    }
  }

  return {
    ok: false,
    code: "UNKNOWN_ERROR",
    message: "Unexpected error",
    details: scrubToolErrorDetails(redactSecrets(error, knownSecrets), knownSecrets),
  }
}
