---
phase: 01-package-skeleton-opencode-registration
plan: "02"
subsystem: runtime-registration
tags: [opencode-plugin, tool-registry, static-manifest, no-network, documentation]

requires:
  - phase: 01-package-skeleton-opencode-registration-01
    provides: Bun/TypeScript ESM package skeleton and version helper
provides:
  - Static v1 public tool manifest with all 17 roadmap-locked names
  - Network-free opencode tool registry builder and placeholder execute handlers
  - Default @opencode-ai/plugin export returning the static tool registry
  - README documentation for the stable v1 namespace and Pi-compatible handoff exception
affects: [phase-1, runtime-registration, auth, meta-tools, trigger-lifecycle, automation-handoff, tests]

tech-stack:
  added: []
  patterns: ["Static manifest as canonical naming source", "Network-free plugin initialization", "Phase-gated placeholder tool output"]

key-files:
  created: [README.md, src/index.ts, src/plugin/manifest.ts, src/plugin/register-tools.ts, src/tools/names.ts, src/tools/static-placeholders.ts]
  modified: [tsconfig.json]

key-decisions:
  - "Registered the final v1 opencode-visible namespace from a static manifest rather than Composio discovery or generated per-app tools."
  - "Kept `save_automation_definition` as the only non-`composio_` public tool name for Pi-compatible automation handoff."
  - "Returned JSON-stringified structured placeholder results so Phase 1 remains compatible with opencode's ToolResult shape while preserving machine-readable metadata."

patterns-established:
  - "`COMPOSIO_TOOL_MANIFEST` is the single source of public v1 tool names and metadata."
  - "`buildComposioToolRegistry()` converts manifest entries into opencode `tool()` definitions without network or credential reads."
  - "Phase 1 placeholders expose final names now and defer Composio behavior to later phases."

duration: 3 min
completed: 2026-05-16
---

# Phase 1 Plan 02: Static opencode Tool Registration Summary

**Static 17-tool opencode registry with network-free placeholders and README-documented v1 namespace contract**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-16T03:38:06Z
- **Completed:** 2026-05-16T03:41:00Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Added a typed canonical manifest for exactly the 17 stable public v1 tool names in the roadmap-required order.
- Documented the stable v1 namespace in `README.md`, including the intentional `save_automation_definition` exception.
- Registered every manifest entry as an `@opencode-ai/plugin` tool with local Phase 1 placeholder handlers.
- Added a default plugin export that returns `{ tool: buildComposioToolRegistry() }` without commands, permission mutation, credentials, Composio imports, or network calls.
- Verified source and built `dist/index.js` expose 17 tools, with no unprefixed public tool except `save_automation_definition`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Define and document the canonical static v1 tool manifest** - `2645c18` (feat)
2. **Task 2: Register manifest entries as network-free opencode tools** - `7909250` (feat)
3. **Task 3: Export the default opencode Plugin entrypoint** - `d648b96` (feat)

**Plan metadata:** committed separately after STATE.md update.

## Files Created/Modified

- `README.md` - Documents the stable v1 tool namespace, all 17 names, static tool strategy, and handoff-name exception.
- `src/plugin/manifest.ts` - Canonical ordered manifest with tool names, descriptions, categories, risk metadata, and target implementation phases.
- `src/tools/names.ts` - Re-exports `REGISTERED_TOOL_NAMES` for tests and docs.
- `src/tools/static-placeholders.ts` - Creates opencode `tool()` placeholders with structured local output and debug info.
- `src/plugin/register-tools.ts` - Converts manifest entries into a typed opencode tool registry keyed by exact public names.
- `src/index.ts` - Default `Plugin` export returning the static tool registry.
- `tsconfig.json` - Adds `ignoreDeprecations: "6.0"` so tsup declaration generation succeeds under TypeScript 6.

## Decisions Made

- Registered the final v1 opencode-visible namespace from a static manifest rather than Composio discovery or generated per-app tools, preserving no-network startup.
- Preserved `save_automation_definition` as the only non-`composio_` public tool name because it is roadmap-locked for Pi-compatible handoff.
- Encoded placeholder responses as JSON output plus metadata, matching opencode's `ToolResult` type while keeping the planned structured payload shape.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Silenced TypeScript 6 declaration-build deprecation error**
- **Found during:** Task 3 (Export the default opencode Plugin entrypoint)
- **Issue:** `bun run build` failed during tsup DTS generation with TS5101 because a dependency/tooling-provided `baseUrl` option is deprecated in TypeScript 6 unless deprecations are explicitly acknowledged.
- **Fix:** Added `"ignoreDeprecations": "6.0"` to `tsconfig.json`, allowing declaration generation to proceed without weakening typechecking.
- **Files modified:** `tsconfig.json`
- **Verification:** `bun run typecheck` and `bun run build` both pass; `dist/index.js` and `dist/index.d.ts` are produced.
- **Committed in:** `d648b96` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Build tooling compatibility fix only; no runtime scope or architecture changed.

## Issues Encountered

- tsup declaration generation initially failed on a TypeScript 6 deprecation gate; resolved with the documented compiler option above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for Plan 03 to add naming/no-network tests, local build-load integration, opencode config example, and smoke script.
- The default plugin entrypoint and built output now expose all 17 fixed v1 tool names without Composio credentials or startup network calls.

---
*Phase: 01-package-skeleton-opencode-registration*
*Completed: 2026-05-16*

## Self-Check: PASSED

- Verified key files exist: `README.md`, `src/index.ts`, `src/plugin/manifest.ts`, `src/plugin/register-tools.ts`, `src/tools/names.ts`, `src/tools/static-placeholders.ts`, `tsconfig.json`.
- Verified task commits exist: `2645c18`, `7909250`, `d648b96`.
- Verified `bun run typecheck`, `bun run build`, no-network grep, namespace grep, and built plugin registration check all pass.
