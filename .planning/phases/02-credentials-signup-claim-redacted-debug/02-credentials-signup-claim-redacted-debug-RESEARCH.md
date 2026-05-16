# Phase 2: Credentials, Signup, Claim & Redacted Debug - Research

**Researched:** 2026-05-16  
**Domain:** opencode plugin auth resolution, Composio agent signup/claim endpoints, local credential persistence, redacted diagnostics  
**Confidence:** MEDIUM-HIGH

## Summary

Phase 2 should replace the Phase 1 placeholders for `composio_signup`, `composio_claim`, and `composio_debug_info`, add the `/composio-claim <email>` opencode command path, and introduce a shared auth/credential service used by later Composio runtime phases. The credential precedence is project-specific and should be explicit: `COMPOSIO_API_KEY` wins, then `~/.composio/anonymous_user_data.json` `composio.api_key`; when neither is present, user-facing failures should tell the agent to call `composio_signup`.

Composio's official current docs now document the agent signup API directly. The endpoint family is `https://agents.composio.dev`: `POST /api/signup` with `{}` creates an anonymous agent identity, `GET /api/whoami` with `Authorization: Bearer <agent_key>` verifies/reuses it, and `POST /api/claim` with `{ "email": "human@example.com" }` sends a 24-hour single-use admin invite. This aligns closely with the existing `composio-x-pi` implementation and tests, but there is one important mismatch: official docs say `?wait=0` skips waiting, while `composio-x-pi` sends `?wait=true`. Prefer official docs for new implementation; if copying `composio-x-pi`, add live/API-contract tests around wait semantics.

**Primary recommendation:** Implement a small `auth/` service layer with redaction-by-default outputs, official Composio agent endpoints, atomic/restrictive credential file writes, and opencode command registration through plugin `command` config/hooks rather than scattering auth logic inside individual tools.

## Standard Stack

### Core
| Library / API | Version | Purpose | Why Standard |
|---|---:|---|---|
| Bun runtime + `globalThis.fetch` | `1.3.10` in this repo | HTTP calls to `agents.composio.dev`, tests, file-mode checks | No extra HTTP dependency needed; Bun provides fetch, TypeScript execution, and `bun test`. |
| `@opencode-ai/plugin` | `1.15.0` | Register Phase 2 tools and plugin hooks/config surface | Official opencode plugin docs use `tool()` and plugin returns for custom tools. |
| `zod` / `tool.schema` | `4.4.3` direct dependency | Tool arg validation for `composio_signup({ force? })`, `composio_claim({ email })`, `composio_debug_info({})` | Already in repo and matches opencode tool schema style. |
| Node/Bun `fs`, `fs/promises`, `os`, `path` | Built-in | `~/.composio/anonymous_user_data.json` read/write and mode checks | Secure local persistence needs direct file APIs and no third-party config store. |
| Composio agent signup HTTP API | Current docs fetched 2026-05-16 | Anonymous identity creation, reuse, claim handoff | Official Composio docs explicitly define this flow and response shapes. |

### Supporting
| Library / API | Version | Purpose | When to Use |
|---|---:|---|---|
| `@composio/core` | `0.10.0` latest npm | Later Composio SDK client creation from resolved API key | Add in Phase 2 only if the shared auth service includes a lazy client factory for later phases; do not import at plugin startup. |
| `node:crypto` | Built-in | Temporary file names for atomic writes | Use for `anonymous_user_data.json.<random>.tmp` before rename. |
| opencode custom commands | Docs last updated 2026-05-15 | `/composio-claim <email>` human-facing path | Use markdown/config command if package can ship example config; use plugin command/TUI hook only if current plugin API supports it in implementation. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|---|---|---|
| Direct `fetch` to `agents.composio.dev` | Composio SDK | The agent signup/claim endpoints are not the normal SDK session APIs; direct HTTP is the documented integration. |
| `~/.composio/anonymous_user_data.json` | opencode config variables or project-local file | Requirement explicitly names the global Composio anonymous file; project files risk accidental commit. |
| Redaction helper | Ad hoc `replace(apiKey, '***')` per caller | Ad hoc redaction misses nested fields, error bodies, logs, and test failures. Centralize it. |
| Custom command only | Tool only | Requirement AUTH-07 requires a slash-command path; implement both tool and command. |

**Installation:**
```bash
# Keep existing stack; add @composio/core only if a lazy SDK client factory lands in Phase 2.
bun add @composio/core@^0.10.0
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── auth/
│   ├── anonymous-user-data.ts   # path resolution, schema-lite parsing, atomic 0600 write
│   ├── agent-api.ts             # fetch wrappers for signup/whoami/claim, no opencode imports
│   ├── resolve-auth.ts          # COMPOSIO_API_KEY precedence, anonymous fallback, errors
│   ├── signup-flow.ts           # idempotent ensureIdentity + claimIdentity orchestration
│   └── redact.ts                # secret-key/value redaction for logs/tool outputs/errors
├── commands/
│   └── composio-claim.ts        # slash-command prompt/template or plugin command hook glue
├── tools/
│   ├── auth.ts                  # createSignupTool/createClaimTool
│   ├── debug-info.ts            # runtime/auth diagnostics only, redacted
│   └── static-placeholders.ts   # retain later-phase placeholders
└── plugin/
    ├── register-tools.ts        # replace Phase 1 placeholders for Phase 2 tools
    └── manifest.ts              # update descriptions/phase metadata if needed
test/unit/
├── auth-resolution.test.ts
├── anonymous-user-data.test.ts
├── signup-flow.test.ts
├── redaction.test.ts
├── debug-info.test.ts
└── composio-claim-command.test.ts
test/integration/
└── live-agent-signup.test.ts    # opt-in only; isolated HOME; never claim unless explicit email
```

### Pattern 1: Credential Resolver With Explicit Source
**What:** Return both the usable key and non-secret metadata (`source`, `path`, `present`) from one resolver.  
**When to use:** Every tool or later SDK factory that needs Composio auth.  
**Example:**
```typescript
// Source: project requirements AUTH-01/AUTH-02/AUTH-08 + composio-x-pi src/composio-client.ts
export type AuthSource = "env" | "anonymous" | null

export function resolveComposioAuth(env = process.env): {
  apiKey?: string
  source: AuthSource
  anonymousPath: string
  debug: { apiKeyPresent: boolean; authSource: AuthSource; envKeyPrecedence: boolean }
} {
  const envKey = env.COMPOSIO_API_KEY?.trim()
  if (envKey) {
    return {
      apiKey: envKey,
      source: "env",
      anonymousPath: getAnonymousUserDataPath(),
      debug: { apiKeyPresent: true, authSource: "env", envKeyPrecedence: true },
    }
  }

  const anonymous = readAnonymousUserData()
  const anonKey = typeof anonymous?.composio?.api_key === "string" ? anonymous.composio.api_key.trim() : ""
  if (anonKey) {
    return {
      apiKey: anonKey,
      source: "anonymous",
      anonymousPath: getAnonymousUserDataPath(),
      debug: { apiKeyPresent: true, authSource: "anonymous", envKeyPrecedence: false },
    }
  }

  return {
    source: null,
    anonymousPath: getAnonymousUserDataPath(),
    debug: { apiKeyPresent: false, authSource: null, envKeyPrecedence: false },
  }
}
```

### Pattern 2: Signup Flow Is Idempotent by Verifying `agent_key`
**What:** If anonymous data exists, call `GET /api/whoami` with the persisted `agent_key`; reuse credentials only when status is ready and an API key is available. Otherwise call signup and persist the full response.  
**When to use:** `composio_signup` and missing-credential guidance.  
**Example:**
```typescript
// Source: https://docs.composio.dev/docs/signing-up-as-an-agent.md
const AGENT_BASE_URL = "https://agents.composio.dev"

export async function signUpAgent(opts: { wait?: boolean; force?: boolean } = {}) {
  const params = new URLSearchParams()
  // Official docs: omit wait for default long-poll; pass wait=0 to skip waiting.
  if (opts.wait === false) params.set("wait", "0")
  if (opts.force) params.set("force", "true") // supported by composio-x-pi; validate live before relying on it.

  const res = await fetch(`${AGENT_BASE_URL}/api/signup${params.size ? `?${params}` : ""}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  })
  if (res.status === 202) throw new UserFacingError("AGENT_SIGNUP_PENDING", "Composio signup is pending; retry shortly.", await safeJson(res))
  if (!res.ok) throw await redactedHttpError("AGENT_SIGNUP_FAILED", res)
  return assertAnonymousUserData(await res.json())
}
```

### Pattern 3: Redaction at the Boundary
**What:** Any object returned by tools, included in error details, or logged through opencode must pass through a central redactor.  
**When to use:** All auth/signup/claim/debug code and test snapshot output.  
**Example:**
```typescript
// Source: AUTH-08; secret fields from official agent signup response.
const SECRET_KEY_RE = /(^|_)(api[_-]?key|user[_-]?api[_-]?key|agent[_-]?key|token|secret|authorization)($|_)/i

export function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets)
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, inner]) => [
    key,
    SECRET_KEY_RE.test(key) ? "[REDACTED]" : redactSecrets(inner),
  ]))
}
```

### Pattern 4: Human Slash Command Produces a Prompt/Action, Not a Secret
**What:** `/composio-claim <email>` should validate/prompt for email and call the same `claimIdentity` service as `composio_claim`; output status and next steps only.  
**When to use:** AUTH-07.  
**Example:**
```markdown
<!-- Source: https://opencode.ai/docs/commands/ -->
---
description: Request handoff of the anonymous Composio org to a human admin
---
Call the `composio_claim` tool with this email: $ARGUMENTS
Then summarize the returned status and next steps. Do not print any API keys or agent keys.
```

### Anti-Patterns to Avoid
- **Reading anonymous credentials before env credentials:** violates env-key precedence and can cause a stale anonymous key to shadow a deliberate `COMPOSIO_API_KEY`.
- **Returning persisted signup JSON directly:** official signup JSON contains `agent_key`, `composio.api_key`, and `composio.user_api_key`; returning it violates AUTH-08.
- **Claiming during signup:** claim sends a real invite and should only run from explicit `composio_claim` or `/composio-claim` requests.
- **Creating Composio SDK clients at plugin startup:** Phase 1 no-network/lazy boundary still applies; Phase 2 auth resolution should run on execute/debug only.
- **Project-local credential fallback:** requirement says `~/.composio/anonymous_user_data.json`; do not add undocumented project credential search paths in v1.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Agent signup protocol | A browser automation flow against Composio platform | Official `agents.composio.dev` HTTP endpoints | Docs define endpoint payloads and response shapes. |
| JSON schema library for tool args | Custom validators | Existing `tool.schema` / Zod | Keeps opencode-visible schemas consistent. |
| Secret scrubbing per field | Per-call string replace | Recursive `redactSecrets()` and tests | Secrets appear in nested JSON, HTTP errors, and metadata. |
| Secure credential storage abstraction | Keychain wrapper or encrypted custom vault | `~/.composio/anonymous_user_data.json` with `0600` best-effort | Requirement explicitly wants this file; encryption/keychain adds portability/UX risk. |
| Command parser | Custom slash-command runtime | opencode custom command files/config and shared claim tool | opencode already supports `$ARGUMENTS` commands. |

**Key insight:** The hard part is not signup HTTP; it is keeping every success, debug, error, and test path useful while provably never exposing `COMPOSIO_API_KEY`, `agent_key`, `api_key`, or `user_api_key`.

## Common Pitfalls

### Pitfall 1: Official wait parameter differs from `composio-x-pi`
**What goes wrong:** Implementation sends `?wait=true` copied from Pi, but official docs document default wait and `?wait=0` to skip waiting.  
**Why it happens:** Pi source predates/varies from current docs.  
**How to avoid:** Omit `wait` for normal signup; support `wait=false` as `wait=0`; add an opt-in live contract test before relying on `force=true` or alternative wait values.  
**Warning signs:** Unit tests only assert Pi URL strings like `/api/signup?wait=true`.

### Pitfall 2: File permissions only applied on create
**What goes wrong:** Existing file with permissive mode remains readable after overwrite.  
**Why it happens:** `writeFile(..., { mode: 0o600 })` applies mode when creating new files, but may not change an existing file's mode on all platforms.  
**How to avoid:** Write to a new temp file with mode `0o600`, `chmod(0o600)` best-effort, then `rename`; optionally `chmod` final path after rename. Skip hard failure on platforms/filesystems that do not support POSIX modes, but report `restrictivePermissions: false` in debug/test metadata.  
**Warning signs:** Test covers only a newly created temp HOME file.

### Pitfall 3: Error bodies leak secrets
**What goes wrong:** A failed `whoami`, signup, or claim response body is included in `UserFacingError.details` and later printed.  
**Why it happens:** HTTP helpers attach raw `await response.text()` or parsed JSON.  
**How to avoid:** Parse and redact error details before constructing errors; include status/statusText and a bounded redacted body only.  
**Warning signs:** Tests assert exact raw error body strings.

### Pitfall 4: Debug info is too helpful
**What goes wrong:** `composio_debug_info` prints paths plus raw env or anonymous data to aid troubleshooting.  
**Why it happens:** Debug tooling tends to dump config objects.  
**How to avoid:** Allow only an explicit safe allowlist: package name/version, auth source, booleans, anonymous file existence/path, handoff path/command name, registered tool names, redaction status.  
**Warning signs:** Debug output includes `apiKey`, `agent_key`, `composio`, `Authorization`, or credential prefixes like `ak_`/`uak_`.

### Pitfall 5: Slash command cannot directly execute package code
**What goes wrong:** Planner assumes npm package can automatically install a `/composio-claim` command file into every user config.  
**Why it happens:** opencode custom commands are normally config/markdown files loaded from global/project command directories, not npm package files.  
**How to avoid:** Verify plugin command hook availability during implementation. If plugin-level command registration is not available, ship a documented `.opencode/commands/composio-claim.md` template and test it as an example; the command should instruct the agent to call `composio_claim`.  
**Warning signs:** Package code writes into `~/.config/opencode/commands` without user consent.

## Code Examples

Verified patterns from official/current sources:

### Official agent signup request/response
```bash
# Source: https://docs.composio.dev/docs/signing-up-as-an-agent.md
curl -sS -X POST 'https://agents.composio.dev/api/signup' \
  -H 'content-type: application/json' \
  -d '{}' \
  -o ~/.composio/anonymous_user_data.json
```

Successful response contains secrets and must not be returned raw:
```json
{
  "status": "ready",
  "request_id": "req_xxx",
  "slug": "amber-cedar-otter",
  "email": "amber-cedar-otter@agent.composio.ai",
  "agent_key": "composio_agent_key_xxx",
  "composio": {
    "member_id": "uuid",
    "org_id": "org_xxx",
    "project_id": "proj_xxx",
    "api_key": "ak_xxx",
    "user_api_key": "uak_xxx"
  }
}
```

### Official claim request/response
```bash
# Source: https://docs.composio.dev/docs/signing-up-as-an-agent.md
AGENT_KEY="$(jq -r '.agent_key' ~/.composio/anonymous_user_data.json)"

curl -sS -X POST 'https://agents.composio.dev/api/claim' \
  -H "Authorization: Bearer ${AGENT_KEY}" \
  -H 'content-type: application/json' \
  -d '{"email":"human@example.com"}'
```

Response:
```json
{
  "status": "invited",
  "email": "human@example.com",
  "org_id": "org_xxx",
  "invite_code": "inv_xxx"
}
```

### Secure anonymous file write pattern
```typescript
// Source: Node/Bun fs APIs; requirement AUTH-04.
export async function writeAnonymousUserData(data: AnonymousUserData): Promise<void> {
  const file = getAnonymousUserDataPath()
  const dir = dirname(file)
  await mkdir(dir, { recursive: true, mode: 0o700 })
  const tmp = join(dir, `.${basename(file)}.${crypto.randomUUID()}.tmp`)
  await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, { encoding: "utf8", mode: 0o600 })
  await chmod(tmp, 0o600).catch(() => undefined)
  await rename(tmp, file)
  await chmod(file, 0o600).catch(() => undefined)
}
```

### Redacted debug result shape
```typescript
// Source: RUNT-02 + AUTH-08 + current repo manifest.
return {
  title: "Composio debug info",
  output: JSON.stringify({
    packageName: PACKAGE_NAME,
    packageVersion: PACKAGE_VERSION,
    auth: {
      source: auth.source,              // "env" | "anonymous" | null
      apiKeyPresent: Boolean(auth.apiKey),
      envKeyPrecedence: auth.source === "env",
      anonymousDataPath: auth.anonymousPath,
      anonymousDataPresent: Boolean(readAnonymousUserData()),
    },
    handoff: {
      tool: "composio_claim",
      command: "/composio-claim <email>",
      anonymousIdentityPresent: Boolean(readAnonymousUserData()?.agent_key),
    },
    registeredTools: REGISTERED_TOOL_NAMES,
    redaction: { enabled: true, secretValuesPrinted: false },
  }, null, 2),
}
```

## State of the Art

| Old Approach | Current Approach | When Changed / Verified | Impact |
|---|---|---|---|
| Human must create platform account/API key first | Agent can call `POST /api/signup` and persist anonymous credentials | Official docs fetched 2026-05-16 | Phase 2 can satisfy no-manual-setup. |
| Old Composio terminology: entity/actions/apps/integrations | Current terms: user ID/tools/toolkits/auth configs/connected accounts | Current Composio docs fetched 2026-05-16 | Debug/errors should use current terminology. |
| Pi extension-specific command registration | opencode custom commands via config/markdown with `$ARGUMENTS` | opencode docs last updated 2026-05-15 | `/composio-claim` needs opencode-native implementation or shippable command template. |
| Dump config for debug | Allowlist debug fields and redact everything else | AUTH-08/RUNT-02 | Tests must scan all outputs for secret sentinels. |

**Deprecated/outdated:**
- Do not use old Composio SDK patterns such as `ComposioToolSet`, `actions`, `apps`, or `entity ID` in new code/docs.
- Do not assume `POST /api/signup?wait=true` is canonical; official docs prefer default wait or `wait=0` for non-waiting.
- Do not introduce manual auth-config/connected-account setup for Phase 2; official docs explicitly say agent signup avoids human-created account first.

## Open Questions

1. **Does `POST /api/signup` officially support `force=true`?**
   - What we know: `composio-x-pi` implements/tests `force=true`; official docs fetched 2026-05-16 do not mention force.
   - What's unclear: whether force is supported/stable in production or only a Pi/internal convenience.
   - Recommendation: expose `force?: boolean` only if a live opt-in test confirms it; otherwise implement idempotent signup without public force or mark force experimental.

2. **How should an npm opencode plugin ship `/composio-claim`?**
   - What we know: opencode docs verify custom commands in config or `.opencode/commands/*.md`, with `$ARGUMENTS`; plugin docs list command/TUI events but do not show plugin command registration returning a command object.
   - What's unclear: whether `@opencode-ai/plugin@1.15.0` exposes a stable package-level command registration surface.
   - Recommendation: planner should include an implementation spike/test. If plugin command registration is unavailable, ship a command markdown example and document installing it; keep actual claim behavior in `composio_claim`.

3. **Should `GET /api/cli` be included in Phase 2 debug/handoff path?**
   - What we know: official docs define `GET /api/cli` returning install/login commands; requirements only ask claim and debug handoff path.
   - What's unclear: whether v1 wants CLI handoff command output.
   - Recommendation: do not implement CLI install/login in Phase 2 unless needed; mention claim command/tool as handoff path in debug.

4. **Live API response casing/status details**
   - What we know: official docs show `status: "ready"` for signup and `status: "READY"` for whoami; Pi accepts nested/camelCase claim responses defensively.
   - What's unclear: exact casing and error shape under all states.
   - Recommendation: implement case-insensitive ready checks and tolerant claim parsing (`invite_code`/`inviteCode`, top-level or `data`) while keeping official snake_case in documented outputs.

## Sources

### Primary (HIGH confidence)
- Official Composio Signing Up as an Agent docs, fetched 2026-05-16 — `POST /api/signup`, `GET /api/whoami`, `GET /api/cli`, `POST /api/claim`, response shapes, `agent_key` scope: https://docs.composio.dev/docs/signing-up-as-an-agent.md
- Official Composio Quickstart and Authentication docs, fetched 2026-05-16 — current SDK terminology, `COMPOSIO_API_KEY`, sessions, no manual auth setup for in-chat auth: https://docs.composio.dev/docs/quickstart and https://docs.composio.dev/docs/authentication
- Official opencode Commands docs, fetched 2026-05-16, last updated 2026-05-15 — custom command files/config, `$ARGUMENTS`, command name behavior: https://opencode.ai/docs/commands/
- Official opencode Plugins docs, fetched 2026-05-16, last updated 2026-05-15 — plugin `tool()` registration, plugin events, load behavior, logging: https://opencode.ai/docs/plugins/
- npm registry metadata checked 2026-05-16 — `@composio/core@0.10.0`, `@opencode-ai/plugin@1.15.0`; local Bun `1.3.10`.

### Secondary (MEDIUM confidence)
- Local `composio-x-pi` source, read 2026-05-16 — `src/lib/agent-signup.ts`, `src/lib/signup-flow.ts`, `src/lib/anonymous-user-data.ts`, `src/composio-client.ts`, auth/debug/claim tools and tests. Useful implementation precedent, but lower confidence than official docs where they differ.
- Phase 1 research and current repo source, read 2026-05-16 — package shape, static manifest, no-network startup boundary, existing placeholder tool results.

### Tertiary (LOW confidence)
- None used as authoritative recommendations.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — package versions and opencode/Composio docs are current and align with existing repo.
- Architecture: MEDIUM-HIGH — service layering and redaction patterns are straightforward; slash-command packaging needs an implementation spike.
- Signup/claim payloads: MEDIUM-HIGH — official docs now define payloads/response shapes, but `force=true`, wait semantics, and all live error/casing variants need opt-in live validation.
- Pitfalls: HIGH — secret leakage, credential precedence, and startup network risks are directly derived from requirements, official response shapes, and existing code.

**Research date:** 2026-05-16  
**Valid until:** 2026-05-23 for Composio agent endpoint details; 2026-06-15 for opencode command/plugin docs and package versions.
