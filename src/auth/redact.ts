const REDACTED = "[REDACTED]"

const SECRET_KEY_PATTERN =
  /(^|[_-]|\b)(api[_-]?key|user[_-]?api[_-]?key|agent[_-]?key|token|secret|authorization|password)([_-]|\b|$)/i

const SAFE_SECRET_METADATA_KEYS = new Set([
  "apiKeyPresent",
  "envKeyPrecedence",
  "anonymousDataPresent",
  "anonymousIdentityPresent",
  "secretValuesPrinted",
])

const SECRET_VALUE_PATTERNS = [
  /\bBearer\s+[^\s,;"'}\]]+/gi,
  /\bak_[A-Za-z0-9_\-.]+/g,
  /\buak_[A-Za-z0-9_\-.]+/g,
  /\bcomposio_agent_key_[A-Za-z0-9_\-.]+/g,
]

export function redactString(value: string, knownSecrets: readonly string[] = []): string {
  let output = value

  for (const secret of knownSecrets) {
    if (!secret) continue
    output = output.split(secret).join(REDACTED)
  }

  for (const pattern of SECRET_VALUE_PATTERNS) {
    output = output.replace(pattern, REDACTED)
  }

  return output
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === "[object Object]"
}

export function redactSecrets(value: unknown, knownSecrets: readonly string[] = []): unknown {
  if (typeof value === "string") {
    return redactString(value, knownSecrets)
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactSecrets(entry, knownSecrets))
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message, knownSecrets),
    }
  }

  if (!isPlainObject(value)) {
    return value
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      SECRET_KEY_PATTERN.test(key) && !SAFE_SECRET_METADATA_KEYS.has(key)
        ? REDACTED
        : redactSecrets(entry, knownSecrets),
    ]),
  )
}
