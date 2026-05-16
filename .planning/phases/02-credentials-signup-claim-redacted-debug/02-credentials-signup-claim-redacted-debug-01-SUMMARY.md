---
phase: 02-credentials-signup-claim-redacted-debug
plan: "01"
subsystem: auth
tags: [credentials, anonymous-auth, redaction, user-facing-errors, bun-test]

requires:
  - phase: 01-package-skeleton-opencode-registration
    provides: Static opencode plugin registry and placeholder tool surface
provides:
  - Central recursive redaction helpers for secret-bearing output, errors, and diagnostics
  - User-facing auth error payload primitive with safe serialized metadata
  - Anonymous Composio credential persistence at ~/.composio/anonymous_user_data.json
  - Env-first Composio credential resolver with signup-oriented missing-credential guidance
affects: [phase-2-signup, phase-2-claim, phase-2-debug-info, phase-3-meta-tools, phase-4-triggers]

tech-stack:
  added: []
  patterns:
    - Central boundary redactor for tool/error/debug outputs
    - Atomic credential file writes through temp-file rename and best-effort chmod
    - Credential resolver returns source plus non-secret debug metadata

key-files:
  created:
    - src/auth/redact.ts
    - src/auth/errors.ts
    - src/auth/anonymous-user-data.ts
    - src/auth/resolve-auth.ts
    - test/unit/redaction.test.ts
    - test/unit/anonymous-user-data.test.ts
    - test/unit/auth-resolution.test.ts
  modified: []

key-decisions:
  - "Kept COMPOSIO_API_KEY as the highest-precedence credential source while reporting anonymous-data presence only as non-secret debug metadata."
  - "Used ~/.composio/anonymous_user_data.json as the only default anonymous credential location, matching Composio/Pi compatibility requirements."
  - "Centralized redaction in src/auth/redact.ts so later signup, claim, debug, and runtime tools do not implement ad hoc secret replacement."

patterns-established:
  - "Auth modules are framework-independent services under src/auth and do not import opencode plugin runtime code."
  - "Tests use isolated temp HOME directories for credential persistence rather than touching real user Composio files."
  - "Secret sentinel tests assert serialized outputs omit raw API keys, user API keys, agent keys, bearer tokens, and known secret values."

duration: 3 min
completed: 2026-05-16
---

# Phase 2 Plan 01: Auth Foundation Summary

**Env-first Composio credential resolution with secure anonymous credential persistence and centralized redaction-safe error output**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-16T04:14:33Z
- **Completed:** 2026-05-16T04:18:10Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Added recursive redaction helpers that remove secret-shaped fields and known secret values from nested objects, arrays, strings, and errors.
- Added `UserFacingError` and `toToolErrorPayload()` so later tool handlers can return safe structured error metadata.
- Implemented anonymous credential read/write helpers for `~/.composio/anonymous_user_data.json`, including schema-lite parsing, invalid-file tolerance, formatted JSON, atomic rename, and restrictive permissions on POSIX platforms.
- Implemented `resolveComposioAuth()` with `COMPOSIO_API_KEY` precedence, anonymous fallback, debug metadata, and `composio_signup`-first missing-credential guidance.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add redaction and user-facing error primitives** - `2e3d3f1` (feat)
2. **Task 2: Implement anonymous credential file persistence** - `06bfff5` (feat)
3. **Task 3: Implement env-first credential resolution and signup guidance** - `cd609ba` (feat)

**Plan metadata:** committed separately after STATE.md update.

## Files Created/Modified

- `src/auth/redact.ts` - Recursive redaction boundary for secret-shaped keys, bearer/API-key-like strings, and caller-provided known secret values.
- `src/auth/errors.ts` - User-facing error class and tool error payload converter that redacts messages/details before serialization.
- `src/auth/anonymous-user-data.ts` - Anonymous credential type definitions, global path resolution, tolerant reads, and atomic restrictive writes.
- `src/auth/resolve-auth.ts` - Env-first credential resolver, anonymous fallback, non-secret debug metadata, and signup guidance message.
- `test/unit/redaction.test.ts` - Unit coverage proving sentinel secrets are absent from redacted strings, nested structures, and error payloads.
- `test/unit/anonymous-user-data.test.ts` - Unit coverage for path resolution, missing/invalid reads, formatted writes, and POSIX permissions.
- `test/unit/auth-resolution.test.ts` - Unit coverage for env-only, anonymous-only, env-over-anonymous, empty env fallback, malformed anonymous data, and missing-credential guidance.

## Decisions Made

- Kept `COMPOSIO_API_KEY` as the highest-precedence credential source while reporting anonymous-data presence only as non-secret debug metadata; this supports CI/power users without stale anonymous credentials shadowing env auth.
- Used `~/.composio/anonymous_user_data.json` as the only default anonymous credential location to preserve Composio/Pi behavior and avoid unplanned project-local credential stores.
- Centralized redaction in `src/auth/redact.ts`; later signup, claim, debug, and runtime tools should pass outputs/errors through this boundary instead of adding per-call replacement logic.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Verification

- `bun test test/unit/redaction.test.ts test/unit/anonymous-user-data.test.ts test/unit/auth-resolution.test.ts && bun run typecheck` passed.
- Sentinel assertions confirm serialized redaction and error test outputs do not contain `ak_test_secret`, `uak_test_secret`, `composio_agent_key_secret`, or `Bearer secret`.

## Next Phase Readiness

- Ready for Plan 02 to implement the official Composio anonymous signup/whoami flow using `writeAnonymousUserData()`, `resolveComposioAuth()`, and boundary redaction.
- Claim, debug, and later runtime tools now have shared safe credential/error primitives to reuse.

---
*Phase: 02-credentials-signup-claim-redacted-debug*
*Completed: 2026-05-16*

## Self-Check: PASSED

- Found all created files: `src/auth/redact.ts`, `src/auth/errors.ts`, `src/auth/anonymous-user-data.ts`, `src/auth/resolve-auth.ts`, `test/unit/redaction.test.ts`, `test/unit/anonymous-user-data.test.ts`, `test/unit/auth-resolution.test.ts`.
- Found all task commits: `2e3d3f1`, `06bfff5`, `cd609ba`.
- Verified plan command passes: `bun test test/unit/redaction.test.ts test/unit/anonymous-user-data.test.ts test/unit/auth-resolution.test.ts && bun run typecheck`.
