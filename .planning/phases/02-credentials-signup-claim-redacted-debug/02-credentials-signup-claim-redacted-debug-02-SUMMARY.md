---
phase: 02-credentials-signup-claim-redacted-debug
plan: "02"
subsystem: auth
tags: [composio-agent-signup, anonymous-auth, whoami, redaction, opencode-tool, bun-test]

requires:
  - phase: 02-credentials-signup-claim-redacted-debug-01
    provides: Anonymous credential persistence, redaction helpers, and user-facing error payloads
provides:
  - Direct official Composio agent signup and whoami HTTP wrappers with redacted errors
  - Idempotent anonymous identity orchestration that verifies existing agent keys before reuse
  - Redacted composio_signup opencode tool factory
  - Opt-in live agent signup contract test gated by RUN_COMPOSIO_LIVE_AGENT_TESTS=1
affects: [phase-2-claim, phase-2-debug-info, phase-2-registry-wiring, phase-3-meta-tools]

tech-stack:
  added: []
  patterns:
    - Direct fetch wrappers against https://agents.composio.dev with injected fetch/baseUrl for tests
    - Safe summary objects returned at tool boundaries instead of raw anonymous credential JSON
    - Live integration tests are opt-in and isolate HOME to avoid touching real credentials

key-files:
  created:
    - src/auth/agent-api.ts
    - src/auth/signup-flow.ts
    - src/tools/auth.ts
    - test/unit/agent-api.test.ts
    - test/unit/signup-flow.test.ts
    - test/unit/auth-tools.test.ts
    - test/integration/live-agent-signup.test.ts
  modified: []

key-decisions:
  - "Used direct fetch wrappers for official agents.composio.dev signup/whoami endpoints and did not add @composio/core."
  - "Exposed only wait?: boolean for signup, mapping wait=false to official wait=0 and intentionally omitting undocumented force support."
  - "Made existing anonymous credential reuse conditional on whoami readiness plus a persisted usable composio.api_key, while returning only redacted summaries."
  - "Kept live signup verification opt-in behind RUN_COMPOSIO_LIVE_AGENT_TESTS=1 with isolated temporary HOME."

patterns-established:
  - "Auth HTTP modules accept fetchImpl/baseUrl injection so unit tests remain network-free."
  - "Tool outputs serialize the safe metadata object exactly, making agent-visible JSON and machine metadata consistent."
  - "Tests assert absence of raw agent_key, api_key, and user_api_key sentinels in success and error boundaries."

duration: 5 min
completed: 2026-05-16
---

# Phase 2 Plan 02: Anonymous Signup Flow Summary

**Official Composio agent signup/whoami flow with idempotent local credential persistence and redacted opencode tool output**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-16T04:20:25Z
- **Completed:** 2026-05-16T04:25:52Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Added `signUpAgent()` and `whoAmI()` wrappers for official `POST /api/signup` and `GET /api/whoami` endpoints with mocked tests for URL/query/header/body behavior.
- Added `ensureAnonymousIdentity()` to reuse valid persisted anonymous credentials only after whoami verification, otherwise signup and persist fresh ready credentials.
- Added `createSignupTool()` for `composio_signup`, returning JSON-stringified safe summaries and redacted tool error payloads.
- Added an opt-in live contract test that skips by default and validates real signup/whoami behavior only when `RUN_COMPOSIO_LIVE_AGENT_TESTS=1` is set.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add redacted Composio agent signup API wrappers** - `9cccc84` (feat)
2. **Task 2: Add idempotent anonymous signup orchestration** - `db54b79` (feat)
3. **Task 3: Create composio_signup tool factory and opt-in live contract test** - `cae9343` (feat)
4. **Verification fix: satisfy exact optional typechecking** - `0f11336` (fix)

**Plan metadata:** committed separately after STATE.md update.

## Files Created/Modified

- `src/auth/agent-api.ts` - Direct Composio agent signup/whoami fetch wrappers, response normalization, pending/HTTP/JSON/shape errors, and redacted bounded details.
- `src/auth/signup-flow.ts` - Idempotent anonymous identity orchestration with whoami reuse checks, signup persistence, and safe summary creation.
- `src/tools/auth.ts` - `createSignupTool()` factory for redacted `composio_signup` execution.
- `test/unit/agent-api.test.ts` - Mocked fetch coverage for signup/whoami protocol behavior, shape tolerance, ready casing, and redacted errors.
- `test/unit/signup-flow.test.ts` - Unit coverage for no-file signup, valid reuse, invalid whoami fallback, pending signup errors, persistence, wait handling, and redacted summaries.
- `test/unit/auth-tools.test.ts` - Tool factory coverage for safe JSON output and redacted error conversion.
- `test/integration/live-agent-signup.test.ts` - Opt-in live Composio signup/whoami contract test with isolated temporary HOME.

## Decisions Made

- Used direct `fetch` and injected `fetchImpl`/`baseUrl` instead of adding `@composio/core`, preserving the no-startup-network and no-SDK-coupling boundary for signup.
- Implemented official wait semantics only: omit `wait` by default and send `wait=0` when callers pass `wait: false`; undocumented `force=true` remains unexposed.
- Reuse requires both a successful ready whoami response and an existing persisted `composio.api_key`, ensuring stale agent keys do not silently satisfy signup.
- Live API validation is available but skipped by default to keep normal tests network-free and deterministic.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed exact optional property TypeScript failures discovered during overall verification**
- **Found during:** Overall verification after Task 3
- **Issue:** `tsc --noEmit` rejected passing explicit `undefined` values into exact-optional option objects and inferred non-portable Zod types from the signup tool factory.
- **Fix:** Added helpers that omit undefined optional properties, avoided assigning undefined to optional data fields, added a portable `ToolDefinition` return annotation, and adjusted test fetch-call types.
- **Files modified:** `src/auth/signup-flow.ts`, `src/tools/auth.ts`, `test/unit/agent-api.test.ts`, `test/unit/signup-flow.test.ts`, `test/unit/auth-tools.test.ts`
- **Verification:** `bun test test/unit/agent-api.test.ts test/unit/signup-flow.test.ts test/unit/auth-tools.test.ts && bun test test/integration/live-agent-signup.test.ts && bun run typecheck` passed.
- **Committed in:** `0f11336`

---

**Total deviations:** 1 auto-fixed (1 bug).  
**Impact on plan:** Type-only correctness fix required for the planned verification gate; no scope creep or behavioral changes beyond preserving exact-optional compatibility.

## Issues Encountered

- TypeScript exact optional property checks required option objects to omit undefined fields explicitly; resolved in `0f11336`.

## User Setup Required

None - no external service configuration required. Optional live signup validation can be run by setting `RUN_COMPOSIO_LIVE_AGENT_TESTS=1`.

## Verification

- `bun test test/unit/agent-api.test.ts test/unit/signup-flow.test.ts test/unit/auth-tools.test.ts` passed.
- `bun test test/integration/live-agent-signup.test.ts` passed in default skipped/no-network mode.
- `bun run typecheck` passed.
- Source search found no `@composio/core` imports.
- Fetch usage is contained in explicit agent API execution paths; plugin/tool modules only pass fetch implementations and do not perform network work at import time.
- No snapshot files contain raw test secret sentinels.

## Next Phase Readiness

- Ready for Plan 03 to implement anonymous org claim/handoff using the same `agent_key` persistence and redacted error patterns.
- Ready for Plan 04 to wire `createSignupTool()` into the plugin registry and replace the signup placeholder.

---
*Phase: 02-credentials-signup-claim-redacted-debug*
*Completed: 2026-05-16*

## Self-Check: PASSED

- Found all created files: `src/auth/agent-api.ts`, `src/auth/signup-flow.ts`, `src/tools/auth.ts`, `test/unit/agent-api.test.ts`, `test/unit/signup-flow.test.ts`, `test/unit/auth-tools.test.ts`, `test/integration/live-agent-signup.test.ts`.
- Found all task/fix commits: `9cccc84`, `db54b79`, `cae9343`, `0f11336`.
- Verified final plan command passes: `bun test test/unit/agent-api.test.ts test/unit/signup-flow.test.ts test/unit/auth-tools.test.ts && bun test test/integration/live-agent-signup.test.ts && bun run typecheck`.
