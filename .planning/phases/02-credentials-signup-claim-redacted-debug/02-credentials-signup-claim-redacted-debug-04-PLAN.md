---
phase: 02-credentials-signup-claim-redacted-debug
plan: "04"
type: execute
wave: 4
depends_on:
  - 02-credentials-signup-claim-redacted-debug-02
  - 02-credentials-signup-claim-redacted-debug-03
files_modified:
  - src/tools/debug-info.ts
  - src/tools/static-placeholders.ts
  - src/plugin/register-tools.ts
  - src/plugin/manifest.ts
  - test/unit/debug-info.test.ts
  - test/unit/plugin-export.test.ts
  - test/integration/local-load.test.ts
autonomous: true
must_haves:
  truths:
    - "User can run composio_debug_info and see package version, auth source, handoff path, command path, and registered tools"
    - "Debug info indicates COMPOSIO_API_KEY precedence when env auth is active without showing the key"
    - "Debug info falls back to anonymous credential metadata when no env key exists without showing anonymous secrets"
    - "opencode registers real Phase 2 handlers for composio_signup, composio_claim, and composio_debug_info while later-phase tools remain placeholders"
    - "Plugin initialization remains network-free; auth and signup network calls happen only during explicit tool execution"
  artifacts:
    - path: "src/tools/debug-info.ts"
      provides: "Redacted runtime/auth diagnostic tool factory"
      exports: ["createDebugInfoTool"]
    - path: "src/plugin/register-tools.ts"
      provides: "Registry wiring for Phase 2 real handlers and later-phase placeholders"
      exports: ["buildComposioToolRegistry"]
    - path: "src/plugin/manifest.ts"
      provides: "Updated Phase 2 tool descriptions reflecting implemented signup/claim/debug behavior"
    - path: "test/unit/debug-info.test.ts"
      provides: "Debug allowlist and secret-redaction coverage"
  key_links:
    - from: "src/plugin/register-tools.ts"
      to: "src/tools/auth.ts"
      via: "registry maps composio_signup and composio_claim to real tool factories"
      pattern: "createSignupTool|createClaimTool"
    - from: "src/plugin/register-tools.ts"
      to: "src/tools/debug-info.ts"
      via: "registry maps composio_debug_info to redacted debug implementation"
      pattern: "createDebugInfoTool"
    - from: "src/tools/debug-info.ts"
      to: "src/auth/resolve-auth.ts"
      via: "debug displays safe auth metadata from resolver"
      pattern: "resolveComposioAuth"
---

<objective>
Wire Phase 2 auth tools into the opencode registry and replace placeholder diagnostics with a redacted `composio_debug_info` implementation.

Purpose: Users must be able to inspect runtime/auth state safely and execute the implemented signup/claim tools through the stable Phase 1 public names without breaking no-network startup.
Output: Debug tool, registry wiring, updated descriptions, and tests proving safe diagnostics plus plugin load behavior.
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
@.planning/phases/01-package-skeleton-opencode-registration/01-package-skeleton-opencode-registration-03-SUMMARY.md
@.planning/phases/02-credentials-signup-claim-redacted-debug/02-credentials-signup-claim-redacted-debug-01-SUMMARY.md
@.planning/phases/02-credentials-signup-claim-redacted-debug/02-credentials-signup-claim-redacted-debug-02-SUMMARY.md
@.planning/phases/02-credentials-signup-claim-redacted-debug/02-credentials-signup-claim-redacted-debug-03-SUMMARY.md
@src/plugin/manifest.ts
@src/plugin/register-tools.ts
@src/tools/static-placeholders.ts
@src/tools/auth.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Implement redacted runtime debug info</name>
  <files>src/tools/debug-info.ts, test/unit/debug-info.test.ts</files>
  <action>Create `createDebugInfoTool()` that resolves auth via `resolveComposioAuth` at execution time only and returns a strict allowlist: `packageName`, `packageVersion`, `auth.source`, `auth.apiKeyPresent`, `auth.envKeyPrecedence`, `auth.anonymousDataPath`, `auth.anonymousDataPresent`, `handoff.tool: "composio_claim"`, `handoff.command: "/composio-claim <email>"`, `handoff.anonymousIdentityPresent`, `registeredTools`, and `redaction: { enabled: true, secretValuesPrinted: false }`. Do not dump env, anonymous credential JSON, request headers, or raw errors. Use `redactSecrets` on the final payload as a defensive last step. Tests must cover env auth precedence, anonymous fallback, no credentials, command/handoff fields, registered tool list parity, and sentinel secret scan over `JSON.stringify(result)`.</action>
  <verify>bun test test/unit/debug-info.test.ts</verify>
  <done>`composio_debug_info` reports useful runtime/auth metadata while all secret-bearing fields and values remain absent/redacted.</done>
</task>

<task type="auto">
  <name>Task 2: Wire real Phase 2 handlers into the static registry</name>
  <files>src/plugin/register-tools.ts, src/tools/static-placeholders.ts, src/plugin/manifest.ts, test/unit/plugin-export.test.ts</files>
  <action>Update `buildComposioToolRegistry()` so `composio_debug_info` uses `createDebugInfoTool()`, `composio_signup` uses `createSignupTool()`, and `composio_claim` uses `createClaimTool()`. Leave all Phase 3+ meta/trigger/handoff tools on `createPlaceholderTool(manifestEntry)`; do not remove stable names or add generated per-app tools. Update manifest descriptions for these three Phase 2 tools to describe implemented behavior and slash-command handoff. Adjust `static-placeholders.ts` so it no longer special-cases `composio_debug_info`; it should only format later-phase placeholders. Update plugin export tests to assert startup still does not call fetch, registered names are unchanged, debug execution returns auth metadata without secrets, and signup/claim are no longer `not_implemented_in_phase_1` placeholders when executed with mocked dependencies or by checking tool descriptions/outputs safely.</action>
  <verify>bun test test/unit/plugin-export.test.ts && bun run typecheck</verify>
  <done>opencode registry exposes real Phase 2 handlers under the existing stable names while all future-phase tools remain registered placeholders and startup remains network-free.</done>
</task>

<task type="auto">
  <name>Task 3: Refresh integration/smoke expectations for Phase 2</name>
  <files>test/integration/local-load.test.ts</files>
  <action>Update the local build-output integration test to validate built `dist/index.js` still registers exactly the static manifest names and that `composio_debug_info` from the built plugin reports package/version/auth/handoff/registeredTools with `redaction.enabled === true`. Keep the integration local-only and network-free by monkey-patching `globalThis.fetch` before invoking the built plugin/debug tool; the test must fail if startup or debug info performs a Composio network call. Do not make live signup part of default `test:integration`; the opt-in live test from Plan 02 remains gated.</action>
  <verify>bun run build && bun test test/integration/local-load.test.ts && bun run smoke:local</verify>
  <done>Built plugin load verification reflects Phase 2 debug behavior, preserves the exact v1 registry, and remains local/network-free by default.</done>
</task>

</tasks>

<verification>
Run `bun run typecheck && bun run build && bun run test && bun run test:integration && bun run smoke:local`. Additionally scan source/tests for accidental raw secret output patterns around debug/auth code and verify no startup test observes `fetch` calls.
</verification>

<success_criteria>
- `composio_debug_info` shows version, auth source, env precedence, anonymous file metadata, handoff path, slash command, registered tools, and redaction status.
- `composio_signup` and `composio_claim` are wired into the plugin registry under their stable Phase 1 names.
- Future phase tools remain placeholders; no v2/generated tool surface appears.
- All default tests/build/smoke remain local-only and network-free except explicit tool execution mocks.
</success_criteria>

<output>
After completion, create `.planning/phases/02-credentials-signup-claim-redacted-debug/02-credentials-signup-claim-redacted-debug-04-SUMMARY.md`
</output>
