---
phase: 01-package-skeleton-opencode-registration
plan: "03"
subsystem: testing
tags: [bun, opencode-plugin, smoke-test, integration-test, manifest]

requires:
  - phase: 01-package-skeleton-opencode-registration-02
    provides: static 17-tool opencode registry and placeholder implementation
provides:
  - Unit contract tests for fixed Composio tool names, namespace rules, and built-in collision avoidance
  - Network-free plugin initialization tests including composio_debug_info credentials-free execution
  - Local dist/index.js integration load test and copyable opencode config example
  - Local smoke script proving built plugin registration from checkout
affects: [phase-2-auth, phase-3-meta-tools, phase-4-triggers, phase-5-handoff, release-readiness]

tech-stack:
  added: []
  patterns:
    - bun:test unit tests for static plugin contracts
    - dist/index.js dynamic import checks for build-output validation
    - local-only smoke script with non-zero failure path

key-files:
  created:
    - test/unit/manifest.test.ts
    - test/unit/plugin-export.test.ts
    - test/integration/local-load.test.ts
    - examples/opencode.local.jsonc
    - scripts/smoke-local.ts
  modified:
    - test/unit/plugin-export.test.ts
    - test/integration/local-load.test.ts

key-decisions:
  - "Treat dist/index.js as the integration/smoke source of truth for local load verification while comparing it against the static source manifest."
  - "Keep examples/opencode.local.jsonc copy-only and do not mutate user opencode configuration automatically."
  - "Keep smoke:local local-only and network-free; it imports built output and asserts the fixed registry."

patterns-established:
  - "Plugin test harness: fake opencode PluginInput is sufficient for registry-only initialization checks."
  - "Startup network guard: monkey-patch globalThis.fetch and fail tests if plugin initialization fetches."
  - "Build-output verification: local integration and smoke paths fail fast when dist/index.js is missing."

duration: 2 min
completed: 2026-05-16
---

# Phase 1 Plan 03: Verification Coverage and Local Load Summary

**Bun-based contract, integration, and smoke coverage proving the static 17-tool opencode plugin loads locally without startup network calls**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-16T03:43:29Z
- **Completed:** 2026-05-16T03:45:47Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Added manifest unit tests that lock the exact 17-name Phase 1 tool order, lowercase format, `composio_` namespace rules, uniqueness, and forbidden built-in/generic collisions.
- Added plugin export tests proving the default plugin registers every manifest tool without calling `globalThis.fetch` during startup, and that `composio_debug_info` returns registered tool names without credentials.
- Added a local build-output integration test, a copyable opencode config example using `plugin: ["./dist/index.js"]`, and a local smoke script that validates the built registry.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add unit tests for naming and plugin startup contracts** - `266442b` (test)
2. **Task 2: Add local build-load integration test and opencode config example** - `3f269fa` (test)
3. **Task 3: Add local smoke script and verify all developer scripts** - `4062614` (test)

**Plan metadata:** created in final docs commit after this summary.

## Files Created/Modified

- `test/unit/manifest.test.ts` - Contract tests for exact registered names, namespace format, uniqueness, and collision avoidance.
- `test/unit/plugin-export.test.ts` - Default plugin startup tests with `globalThis.fetch` guard and debug-info execution check.
- `test/integration/local-load.test.ts` - Build-output import test for `dist/index.js` registry parity.
- `examples/opencode.local.jsonc` - Copyable local opencode plugin config pointing at `./dist/index.js`.
- `scripts/smoke-local.ts` - Local smoke script invoked by `bun run smoke:local` to validate built plugin registration.

## Decisions Made

- Dist integration and smoke checks import `dist/index.js` dynamically so they validate the same built entrypoint local users configure.
- The example opencode config remains copyable documentation only; execution does not modify user configuration.
- Smoke verification stays local-only and network-free, matching Phase 1's no-Composio-runtime-coupling boundary.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Made fake opencode plugin inputs typecheck-safe**
- **Found during:** Task 3 (Add local smoke script and verify all developer scripts)
- **Issue:** The full script contract's `tsc --noEmit` rejected direct casts from simple no-op functions to opencode's `BunShell` type and treated dynamic built plugin imports as possibly undefined.
- **Fix:** Used explicit `unknown` casts for fake `$` fields and narrowed/cast dynamically imported plugin defaults before invocation.
- **Files modified:** `test/unit/plugin-export.test.ts`, `test/integration/local-load.test.ts`, `scripts/smoke-local.ts`
- **Verification:** `bun run typecheck && bun run build && bun run test && bun run test:integration && bun run smoke:local` passed.
- **Committed in:** `4062614` (part of Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The fix was necessary for the planned full developer script contract and did not expand scope.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Verification

- `bun run typecheck && bun run build && bun run test && bun run test:integration && bun run smoke:local` passed.
- `rg "@composio/core|agents\.composio\.dev|backend\.composio\.dev" src test scripts` returned no matches.

## Next Phase Readiness

Phase 1 package skeleton now has local tests, build-output validation, and smoke coverage. Ready for Phase 2 auth/signup work with stable opencode-visible tool contracts protected against accidental drift.

---
*Phase: 01-package-skeleton-opencode-registration*
*Completed: 2026-05-16*

## Self-Check: PASSED

- Found all created files: `test/unit/manifest.test.ts`, `test/unit/plugin-export.test.ts`, `test/integration/local-load.test.ts`, `examples/opencode.local.jsonc`, `scripts/smoke-local.ts`.
- Found all task commits: `266442b`, `3f269fa`, `4062614`.
