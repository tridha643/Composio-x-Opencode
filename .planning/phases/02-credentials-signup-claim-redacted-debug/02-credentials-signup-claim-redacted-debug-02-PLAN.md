---
phase: 02-credentials-signup-claim-redacted-debug
plan: "02"
type: execute
wave: 2
depends_on:
  - 02-credentials-signup-claim-redacted-debug-01
files_modified:
  - src/auth/agent-api.ts
  - src/auth/signup-flow.ts
  - src/tools/auth.ts
  - test/unit/agent-api.test.ts
  - test/unit/signup-flow.test.ts
  - test/unit/auth-tools.test.ts
  - test/integration/live-agent-signup.test.ts
autonomous: true
must_haves:
  truths:
    - "User can call composio_signup with no prior setup to provision an anonymous Composio identity"
    - "Signup persists anonymous credentials locally but never returns raw agent_key, api_key, or user_api_key"
    - "Existing valid anonymous credentials are reused idempotently after whoami verification"
    - "Signup HTTP failures return actionable redacted errors"
  artifacts:
    - path: "src/auth/agent-api.ts"
      provides: "Direct fetch wrappers for agents.composio.dev signup and whoami endpoints"
      exports: ["signUpAgent", "whoAmI"]
    - path: "src/auth/signup-flow.ts"
      provides: "Idempotent anonymous identity creation/reuse orchestration"
      exports: ["ensureAnonymousIdentity"]
    - path: "src/tools/auth.ts"
      provides: "opencode tool factories for composio_signup and later composio_claim"
      exports: ["createSignupTool"]
    - path: "test/integration/live-agent-signup.test.ts"
      provides: "Opt-in live contract test for current Composio agent signup/whoami behavior"
  key_links:
    - from: "src/auth/signup-flow.ts"
      to: "src/auth/anonymous-user-data.ts"
      via: "persist returned anonymous credentials after signup"
      pattern: "writeAnonymousUserData"
    - from: "src/tools/auth.ts"
      to: "src/auth/signup-flow.ts"
      via: "composio_signup execute calls ensureAnonymousIdentity"
      pattern: "ensureAnonymousIdentity"
    - from: "src/auth/agent-api.ts"
      to: "https://agents.composio.dev/api/signup"
      via: "official direct fetch endpoint"
      pattern: "agents\\.composio\\.dev[\\s\\S]*/api/signup"
---

<objective>
Implement Composio anonymous signup as a reusable service and opencode tool factory, using official `agents.composio.dev` endpoints and redacted outputs.

Purpose: This satisfies the no-manual-setup path while preserving Phase 1's no-network startup boundary by doing all HTTP only inside explicit tool execution or opt-in tests.
Output: Agent API wrappers, idempotent signup flow, `composio_signup` tool factory, mocked unit tests, and an opt-in live contract test.
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
@.planning/phases/02-credentials-signup-claim-redacted-debug/02-credentials-signup-claim-redacted-debug-01-SUMMARY.md
@src/auth/anonymous-user-data.ts
@src/auth/redact.ts
@src/auth/errors.ts
@src/plugin/manifest.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add redacted Composio agent signup API wrappers</name>
  <files>src/auth/agent-api.ts, test/unit/agent-api.test.ts</files>
  <action>Create direct `fetch` wrappers for official Composio agent endpoints with no @composio/core dependency and no startup side effects. Implement `signUpAgent({ wait?, fetchImpl?, baseUrl? }?)`: POST `${baseUrl}/api/signup` with `content-type: application/json` and body `{}`; omit `wait` by default, use `wait=0` only when `wait === false`, and do not expose or rely on `force=true` because research says it is not in official docs. Implement `whoAmI(agentKey, opts?)`: GET `/api/whoami` with `Authorization: Bearer <agentKey>`. For non-2xx, 202 pending, invalid JSON, and invalid response shapes, throw `UserFacingError` with redacted bounded details. Tests must mock fetch and assert URL/query/header/body behavior, case-insensitive ready status acceptance, response shape tolerance where research calls out casing, and no raw Authorization or response secrets appear in thrown error payloads.</action>
  <verify>bun test test/unit/agent-api.test.ts</verify>
  <done>API wrappers use official signup/whoami endpoints, handle pending/error states safely, and redact all secret-bearing request/response details.</done>
</task>

<task type="auto">
  <name>Task 2: Add idempotent anonymous signup orchestration</name>
  <files>src/auth/signup-flow.ts, test/unit/signup-flow.test.ts</files>
  <action>Create `ensureAnonymousIdentity({ home?, fetchImpl?, baseUrl?, wait? }?)` that first checks existing anonymous data. If an existing `agent_key` is present, call `whoAmI`; if whoami confirms ready and a usable nested `composio.api_key` exists, reuse the persisted identity and return a safe summary `{ ok: true, status, reused: true, source: "anonymous", slug, email, orgId, projectId, anonymousDataPath, restrictivePermissions? }` with no raw credential fields. If no valid existing identity exists or whoami rejects it, call `signUpAgent`, validate `status: ready`, persist the full response via `writeAnonymousUserData`, and return the same safe summary with `reused: false`. Do not claim during signup. Tests must cover no file signup, valid reuse, invalid whoami causing fresh signup, pending signup error, persistence call, and redacted return shape.</action>
  <verify>bun test test/unit/signup-flow.test.ts</verify>
  <done>Calling signup repeatedly is idempotent when existing credentials verify, fresh credentials are persisted only after ready signup, and returned summaries never include raw secrets.</done>
</task>

<task type="auto">
  <name>Task 3: Create composio_signup tool factory and opt-in live contract test</name>
  <files>src/tools/auth.ts, test/unit/auth-tools.test.ts, test/integration/live-agent-signup.test.ts</files>
  <action>In `src/tools/auth.ts`, create `createSignupTool()` using `tool()` with a minimal schema that allows optional `{ wait?: boolean }` only; do not expose `force` unless the opt-in live test later proves official support. The execute handler must call `ensureAnonymousIdentity`, return opencode ToolResult-compatible `{ title, output: JSON.stringify(safeSummary, null, 2), metadata: safeSummary }`, and convert errors via `toToolErrorPayload`. Add unit tests that execute the tool with mocked service/fetch dependencies if needed and assert safe JSON output plus absence of raw sentinels. Add `test/integration/live-agent-signup.test.ts` gated behind `RUN_COMPOSIO_LIVE_AGENT_TESTS=1`; when unset, the test should skip/pass without network. When enabled, use an isolated temporary HOME, call real signup then whoami against `https://agents.composio.dev`, assert ready status and file persistence, and fail if output contains `agent_key`, `api_key`, or `user_api_key` values.</action>
  <verify>bun test test/unit/auth-tools.test.ts && bun test test/integration/live-agent-signup.test.ts</verify>
  <done>`composio_signup` has a concrete safe tool implementation ready for registry wiring, and live API validation is available without running by default.</done>
</task>

</tasks>

<verification>
Run `bun test test/unit/agent-api.test.ts test/unit/signup-flow.test.ts test/unit/auth-tools.test.ts && bun test test/integration/live-agent-signup.test.ts && bun run typecheck`. Confirm no implementation imports `@composio/core`, no fetch runs at module import time, and no test snapshot/output contains raw secret sentinels.
</verification>

<success_criteria>
- Signup uses official `POST /api/signup` and `GET /api/whoami` direct HTTP only during explicit execution.
- Existing anonymous credentials are reused only after whoami verification.
- New anonymous credentials are persisted with the Plan 01 writer.
- Tool output is structured, useful, and redacted.
</success_criteria>

<output>
After completion, create `.planning/phases/02-credentials-signup-claim-redacted-debug/02-credentials-signup-claim-redacted-debug-02-SUMMARY.md`
</output>
