---
phase: 02-credentials-signup-claim-redacted-debug
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified:
  - src/auth/anonymous-user-data.ts
  - src/auth/resolve-auth.ts
  - src/auth/redact.ts
  - src/auth/errors.ts
  - test/unit/anonymous-user-data.test.ts
  - test/unit/auth-resolution.test.ts
  - test/unit/redaction.test.ts
autonomous: true
must_haves:
  truths:
    - "COMPOSIO_API_KEY takes precedence over anonymous credentials when both are present"
    - "Anonymous credentials are read only from ~/.composio/anonymous_user_data.json when COMPOSIO_API_KEY is absent"
    - "Persisted anonymous credentials use restrictive permissions where the platform supports chmod"
    - "Credential, error, and diagnostic helper outputs redact API keys, agent keys, tokens, and secrets"
  artifacts:
    - path: "src/auth/resolve-auth.ts"
      provides: "Credential resolver with env-first precedence and missing-credential guidance metadata"
      exports: ["resolveComposioAuth", "getMissingCredentialMessage"]
    - path: "src/auth/anonymous-user-data.ts"
      provides: "Anonymous credential path resolution, schema-lite parsing, and atomic 0600 writes"
      exports: ["getAnonymousUserDataPath", "readAnonymousUserData", "writeAnonymousUserData"]
    - path: "src/auth/redact.ts"
      provides: "Recursive redaction for nested tool outputs, HTTP details, errors, and logs"
      exports: ["redactSecrets", "redactString"]
    - path: "src/auth/errors.ts"
      provides: "User-facing redacted error type for auth and HTTP flows"
      exports: ["UserFacingError", "toToolErrorPayload"]
  key_links:
    - from: "src/auth/resolve-auth.ts"
      to: "src/auth/anonymous-user-data.ts"
      via: "anonymous credential fallback after COMPOSIO_API_KEY check"
      pattern: "COMPOSIO_API_KEY[\\s\\S]*readAnonymousUserData"
    - from: "src/auth/errors.ts"
      to: "src/auth/redact.ts"
      via: "error payloads redacted before tool output"
      pattern: "redactSecrets"
---

<objective>
Create the Phase 2 auth foundation: anonymous credential file handling, env-first auth resolution, missing-credential guidance, and centralized redaction.

Purpose: Later signup, claim, debug, and Composio runtime tools need one safe source of truth for credentials and secret handling so AUTH-01, AUTH-02, AUTH-04, AUTH-05, and AUTH-08 cannot diverge per tool.
Output: Shared auth modules plus unit tests proving precedence, persistence, and redaction behavior.
</objective>

<execution_context>
@/Users/tri/.config/opencode/get-shit-done/workflows/execute-plan.md
@/Users/tri/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/02-credentials-signup-claim-redacted-debug/02-credentials-signup-claim-redacted-debug-RESEARCH.md
@.planning/phases/01-package-skeleton-opencode-registration/01-package-skeleton-opencode-registration-02-SUMMARY.md
@.planning/phases/01-package-skeleton-opencode-registration/01-package-skeleton-opencode-registration-03-SUMMARY.md
@src/plugin/manifest.ts
@src/plugin/register-tools.ts
@src/tools/static-placeholders.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add redaction and user-facing error primitives</name>
  <files>src/auth/redact.ts, src/auth/errors.ts, test/unit/redaction.test.ts</files>
  <action>Create `src/auth/redact.ts` with recursive `redactSecrets(value)` and `redactString(value, knownSecrets?)` helpers. Redact keys matching api key, user api key, agent key, token, secret, authorization, password, and known secret string values; preserve non-secret structure and types where practical. Create `src/auth/errors.ts` with `UserFacingError` carrying `code`, safe `message`, and redacted `details`, plus `toToolErrorPayload(error)` returning JSON-serializable safe metadata. Add unit tests before or alongside implementation using sentinel secrets like `ak_test_secret`, `uak_test_secret`, `composio_agent_key_secret`, and `Bearer secret`; assert no serialized output contains those sentinels. Do not use ad hoc per-call string replacement in later modules; this file is the boundary redactor.</action>
  <verify>bun test test/unit/redaction.test.ts</verify>
  <done>Nested objects, arrays, strings, known secret values, and UserFacingError details serialize with `[REDACTED]` and never include raw sentinel secrets.</done>
</task>

<task type="auto">
  <name>Task 2: Implement anonymous credential file persistence</name>
  <files>src/auth/anonymous-user-data.ts, test/unit/anonymous-user-data.test.ts</files>
  <action>Create `AnonymousUserData` types matching official signup response shape enough for Phase 2: `status`, `request_id`, `slug`, `email`, `agent_key`, and nested `composio.member_id`, `org_id`, `project_id`, `api_key`, `user_api_key`. Implement `getAnonymousUserDataPath(home = homedir())` returning `~/.composio/anonymous_user_data.json`; `readAnonymousUserData(options?)` that returns parsed data or `null` for missing/invalid files without throwing raw secrets; `writeAnonymousUserData(data, options?)` that creates `~/.composio` with mode `0700`, writes a random temp file with mode `0600`, best-effort chmods temp and final path to `0600`, then renames atomically. Tests must use an isolated temp HOME/options path, verify path resolution, valid read, missing/invalid handling, atomic JSON formatting, and POSIX mode `0600` when `process.platform !== "win32"`.</action>
  <verify>bun test test/unit/anonymous-user-data.test.ts</verify>
  <done>Anonymous credentials can be read/written from the required global Composio path, invalid files do not crash callers, and written files are restrictive where chmod is supported.</done>
</task>

<task type="auto">
  <name>Task 3: Implement env-first credential resolution and signup guidance</name>
  <files>src/auth/resolve-auth.ts, test/unit/auth-resolution.test.ts</files>
  <action>Create `resolveComposioAuth({ env?, home? }?)` that checks trimmed `env.COMPOSIO_API_KEY` first and returns `{ apiKey, source: "env", anonymousPath, debug: { apiKeyPresent: true, authSource: "env", envKeyPrecedence: true, anonymousDataPresent } }` without reading anonymous `api_key` as the active key. If no env key exists, read `~/.composio/anonymous_user_data.json` and use trimmed `composio.api_key` as `{ source: "anonymous", envKeyPrecedence: false }`; if neither exists return `{ source: null, apiKey: undefined, debug: { apiKeyPresent: false, authSource: null, envKeyPrecedence: false } }`. Add `getMissingCredentialMessage()` that tells agents to call `composio_signup` and never suggests manual key setup as the first path. Tests must cover env-only, anonymous-only, env-over-anonymous precedence, empty env string fallback, malformed anonymous fallback, and missing-credential guidance.</action>
  <verify>bun test test/unit/auth-resolution.test.ts && bun run typecheck</verify>
  <done>AUTH-01, AUTH-02, and AUTH-05 foundations exist with tests proving env-key precedence and signup guidance without exposing secrets.</done>
</task>

</tasks>

<verification>
Run `bun test test/unit/redaction.test.ts test/unit/anonymous-user-data.test.ts test/unit/auth-resolution.test.ts && bun run typecheck`. Also manually inspect serialized test fixtures or assertions to confirm sentinel secrets are absent from any expected output.
</verification>

<success_criteria>
- `resolveComposioAuth` returns env auth before anonymous auth whenever `COMPOSIO_API_KEY` is set.
- Anonymous credential reads/writes target only `~/.composio/anonymous_user_data.json` by default.
- Missing credentials produce actionable `composio_signup` guidance.
- Central redaction helpers and error payloads remove known secret values and secret-shaped fields.
</success_criteria>

<output>
After completion, create `.planning/phases/02-credentials-signup-claim-redacted-debug/02-credentials-signup-claim-redacted-debug-01-SUMMARY.md`
</output>
