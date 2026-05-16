---
phase: 02-credentials-signup-claim-redacted-debug
plan: "03"
subsystem: auth
tags: [composio-claim, anonymous-auth, opencode-tool, slash-command, redaction, bun-test]

requires:
  - phase: 02-credentials-signup-claim-redacted-debug-01
    provides: Anonymous credential persistence, redaction helpers, and user-facing errors
  - phase: 02-credentials-signup-claim-redacted-debug-02
    provides: Signup/whoami anonymous identity flow and auth tool factory patterns
provides:
  - Anonymous organization claim/handoff service using persisted agent_key authorization
  - Safe composio_claim opencode tool factory with missing-signup guidance
  - Local and copyable /composio-claim command templates for claim handoff
affects: [phase-2-debug-info, phase-2-registry-wiring, phase-3-authenticated-meta-tools, documentation]

tech-stack:
  added: []
  patterns:
    - Claim flow accepts fetchImpl/baseUrl injection for deterministic network-free tests
    - Tool outputs serialize only safe status/next-step metadata and scrub sensitive error key names
    - Command templates route human-facing slash commands to registered tools without mutating user config

key-files:
  created:
    - src/auth/claim-flow.ts
    - test/unit/claim-flow.test.ts
    - .opencode/commands/composio-claim.md
    - examples/commands/composio-claim.md
    - test/unit/composio-claim-command.test.ts
  modified:
    - src/tools/auth.ts
    - src/auth/errors.ts
    - test/unit/auth-tools.test.ts

key-decisions:
  - "Claim handoff uses the persisted anonymous agent_key as the only Authorization credential and never includes COMPOSIO_API_KEY or raw invite codes in outputs."
  - "Expose inviteCodePresent rather than raw invite_code so agents can describe progress without leaking handoff tokens."
  - "Provide both repository-local and examples/commands /composio-claim templates because package-level automatic opencode command registration remains uncertain."
  - "Scrub sensitive error key names at the tool payload boundary so serialized tool errors do not expose credential field names or Authorization headers."

patterns-established:
  - "Auth services normalize tolerant Composio response envelopes while returning stable safe summary objects."
  - "Missing anonymous identity is represented as MISSING_ANONYMOUS_IDENTITY with explicit composio_signup-first guidance."
  - "Slash-command markdown is tested as executable product surface, not unverified documentation."

duration: 4 min
completed: 2026-05-16
---

# Phase 2 Plan 03: Anonymous Claim Handoff Summary

**Anonymous Composio organization claim handoff via safe agent-key authorization, composio_claim tooling, and tested /composio-claim commands**

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-16T04:28:21Z
- **Completed:** 2026-05-16T04:32:32Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Added `claimAnonymousIdentity()` to validate claim emails, load persisted anonymous credentials, call `POST /api/claim` with `Authorization: Bearer <agent_key>`, and return safe status/next-step summaries.
- Added `createClaimTool()` alongside `createSignupTool()` so `composio_claim` can execute claim handoff and serialize ToolResult-compatible JSON without credential details.
- Added local and copyable `/composio-claim <email>` command templates with tests proving they route to `composio_claim` and instruct agents not to reveal credentials or raw invite data.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add claim flow service with safe status output** - `68d46c5` (feat)
2. **Task 2: Add composio_claim tool factory** - `85372ba` (feat)
3. **Task 3: Add verifyable slash-command path for /composio-claim** - `00ec58d` (feat)

**Plan metadata:** committed separately after STATE.md update.

## Files Created/Modified

- `src/auth/claim-flow.ts` - Anonymous claim orchestration, email validation, tolerant response parsing, safe next steps, and redacted HTTP errors.
- `test/unit/claim-flow.test.ts` - Unit coverage for validation, missing identity, successful/nested claim responses, authorization request behavior, and error redaction.
- `src/tools/auth.ts` - Adds `createClaimTool()` while preserving `createSignupTool()` in the same auth tool module.
- `src/auth/errors.ts` - Scrubs sensitive key names and Authorization wording from tool error payload details.
- `test/unit/auth-tools.test.ts` - Tests signup/claim tool coexistence, missing-identity guidance, and secret-free serialized output.
- `.opencode/commands/composio-claim.md` - Repository-local opencode slash-command prompt for `/composio-claim <email>`.
- `examples/commands/composio-claim.md` - Copyable command template for package users.
- `test/unit/composio-claim-command.test.ts` - Verifies command content and rejects unsupported automatic config-mutation claims.

## Decisions Made

- Claim uses only the anonymous `agent_key` from `~/.composio/anonymous_user_data.json` for `/api/claim`; no environment API key participates in claim handoff.
- Raw `invite_code` values are never returned; the safe summary reports `inviteCodePresent` and actionable next steps instead.
- Command support is explicit markdown in `.opencode/commands` plus `examples/commands` rather than claiming unsupported global/package command registration.
- Tool error serialization now drops sensitive field names as well as values, preventing agent-visible JSON from containing credential keys or Authorization headers.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Scrubbed sensitive error key names at the tool boundary**
- **Found during:** Task 2 (Add composio_claim tool factory)
- **Issue:** Existing tool error redaction replaced secret values but preserved keys like `agent_key`, `api_key`, and `user_api_key`, which conflicted with the claim tool's stronger secret-free serialized-output requirement.
- **Fix:** Added `scrubToolErrorDetails()` in `src/auth/errors.ts` so tool payloads remove credential/invite/header key names and Authorization wording before serialization.
- **Files modified:** `src/auth/errors.ts`, `test/unit/auth-tools.test.ts`
- **Verification:** `bun test test/unit/auth-tools.test.ts && bun run typecheck` and final plan verification passed.
- **Committed in:** `85372ba`

---

**Total deviations:** 1 auto-fixed (1 missing critical).  
**Impact on plan:** The fix tightened existing tool-boundary redaction to satisfy the planned no-secret-output guarantee; no scope creep.

## Issues Encountered

- Existing error payload redaction retained sensitive key names; resolved under the Rule 2 deviation in Task 2.

## User Setup Required

None - no external service configuration required. Users must run `composio_signup` before `composio_claim` if no anonymous identity exists.

## Verification

- `bun test test/unit/claim-flow.test.ts` passed after Task 1.
- `bun test test/unit/auth-tools.test.ts && bun run typecheck` passed after Task 2.
- `bun test test/unit/composio-claim-command.test.ts` passed after Task 3.
- Final verification passed: `bun test test/unit/claim-flow.test.ts test/unit/auth-tools.test.ts test/unit/composio-claim-command.test.ts && bun run typecheck`.

## Next Phase Readiness

- Ready for Plan 04 to wire concrete auth/debug tools into the plugin registry and replace placeholders.
- Claim exact live API payloads remain a phase-level concern for future live validation, but unit coverage now protects tolerant response handling and secret-free behavior.

---
*Phase: 02-credentials-signup-claim-redacted-debug*
*Completed: 2026-05-16*

## Self-Check: PASSED

- Found all created files: `src/auth/claim-flow.ts`, `test/unit/claim-flow.test.ts`, `.opencode/commands/composio-claim.md`, `examples/commands/composio-claim.md`, `test/unit/composio-claim-command.test.ts`.
- Found all task commits: `68d46c5`, `85372ba`, `00ec58d`.
- Verified final plan command passes: `bun test test/unit/claim-flow.test.ts test/unit/auth-tools.test.ts test/unit/composio-claim-command.test.ts && bun run typecheck`.
