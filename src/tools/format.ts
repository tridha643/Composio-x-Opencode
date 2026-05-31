import { redactSecrets } from "../auth/redact"

export function formatToolResult(title: string, payload: Record<string, unknown>, knownSecrets: readonly string[] = []) {
  const redacted = redactSecrets(payload, knownSecrets) as Record<string, unknown>

  return {
    title,
    output: JSON.stringify(redacted, null, 2),
    metadata: redacted,
  }
}
