---
phase: 01-package-skeleton-opencode-registration
plan: "03"
type: execute
wave: 3
depends_on:
  - 01-package-skeleton-opencode-registration-02
files_modified:
  - test/unit/manifest.test.ts
  - test/unit/plugin-export.test.ts
  - test/integration/local-load.test.ts
  - examples/opencode.local.jsonc
  - scripts/smoke-local.ts
autonomous: true
must_haves:
  truths:
    - "Developer can run unit tests proving stable tool names and no built-in collisions."
    - "Developer can run a plugin initialization test proving no fetch occurs during startup."
    - "Developer can build the package and run a local smoke script from checkout."
    - "A local opencode config example points at the built dist/index.js plugin path."
  artifacts:
    - path: "test/unit/manifest.test.ts"
      provides: "Static tool naming and collision contract tests"
      contains: "composio_debug_info"
    - path: "test/unit/plugin-export.test.ts"
      provides: "Plugin export, registry, and no-network initialization tests"
      contains: "globalThis.fetch"
    - path: "test/integration/local-load.test.ts"
      provides: "Build-output local load integration test"
      contains: "dist/index.js"
    - path: "examples/opencode.local.jsonc"
      provides: "Copyable local opencode plugin config"
      contains: "./dist/index.js"
    - path: "scripts/smoke-local.ts"
      provides: "Local smoke script invoked by package.json smoke:local"
      contains: "REGISTERED_TOOL_NAMES"
  key_links:
    - from: "test/unit/plugin-export.test.ts"
      to: "src/index.ts"
      via: "imports plugin and invokes initialization with fetch patched"
      pattern: "globalThis.fetch"
    - from: "scripts/smoke-local.ts"
      to: "dist/index.js"
      via: "smoke imports built plugin output after build script"
      pattern: "dist/index.js"
    - from: "examples/opencode.local.jsonc"
      to: "dist/index.js"
      via: "opencode plugin config uses built local plugin"
      pattern: '"plugin"[\\s\\S]*"./dist/index.js"'
---

<objective>
Add Phase 1 verification coverage, local load fixture, and smoke-test path.

Purpose: The package skeleton is only useful if developers can prove the tool namespace is stable, startup is network-free, and the built plugin can be loaded from a local checkout.
Output: unit tests, integration/local-load test, opencode example config, and smoke script.
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
@.planning/phases/01-package-skeleton-opencode-registration/01-package-skeleton-opencode-registration-RESEARCH.md
@.planning/phases/01-package-skeleton-opencode-registration/01-package-skeleton-opencode-registration-02-SUMMARY.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add unit tests for naming and plugin startup contracts</name>
  <files>test/unit/manifest.test.ts, test/unit/plugin-export.test.ts</files>
  <action>Create `test/unit/manifest.test.ts` using `bun:test` to assert the registered tool name list has exactly 17 unique names, every name matches `/^[a-z][a-z0-9_]*$/`, every name except `save_automation_definition` starts with `composio_`, no name is in a forbidden built-in/generic set (`bash`, `read`, `write`, `edit`, `search`, `debug`, `delete`, `claim`), and the list exactly matches the Phase 1 research order. Create `test/unit/plugin-export.test.ts` importing the default plugin from `../../src/index`, monkey-patching `globalThis.fetch` to throw/record calls, invoking the plugin with a minimal fake context/client, and asserting all manifest tools are present and fetch was never called during initialization. Include a check that `composio_debug_info.execute` returns registered tool names without requiring credentials.</action>
  <verify>`bun run test` passes for `test/unit`.</verify>
  <done>Unit tests fail if tool names drift, collide with built-ins/generic names, or plugin initialization performs network fetch.</done>
</task>

<task type="auto">
  <name>Task 2: Add local build-load integration test and opencode config example</name>
  <files>test/integration/local-load.test.ts, examples/opencode.local.jsonc</files>
  <action>Create `examples/opencode.local.jsonc` with `$schema: "https://opencode.ai/config.json"` and `plugin: ["./dist/index.js"]`; do not mutate user config automatically. Create `test/integration/local-load.test.ts` that assumes `bun run build` has produced `dist/index.js`, imports the built plugin file, invokes it with the same minimal fake plugin context, and asserts the built registry contains all `REGISTERED_TOOL_NAMES`. If `dist/index.js` is missing, fail with an instruction to run `bun run build` rather than silently skipping.</action>
  <verify>`bun run build && bun run test:integration` passes from the checkout.</verify>
  <done>The built package entrypoint can be imported locally and matches the source manifest, and the example config uses opencode's current `plugin` array shape.</done>
</task>

<task type="auto">
  <name>Task 3: Add local smoke script and verify all developer scripts</name>
  <files>scripts/smoke-local.ts</files>
  <action>Create `scripts/smoke-local.ts` for the `smoke:local` package script. The script should import `../dist/index.js`, invoke the plugin with a minimal fake context/client, compare returned tool keys to `REGISTERED_TOOL_NAMES`, print a concise success line including the count and `examples/opencode.local.jsonc`, and exit non-zero on mismatch or missing build output. Keep the smoke script local-only; do not call Composio, opencode network services, signup, or remote tools.</action>
  <verify>`bun run typecheck && bun run build && bun run test && bun run test:integration && bun run smoke:local` all pass.</verify>
  <done>All Phase 1 required scripts are runnable from the local checkout and prove the built plugin registers the fixed namespace without network startup.</done>
</task>

</tasks>

<verification>
Run the full Phase 1 script contract: `bun run typecheck && bun run build && bun run test && bun run test:integration && bun run smoke:local`. Also run `grep -R "@composio/core\|agents.composio.dev\|backend.composio.dev" src test scripts` and confirm no Phase 1 code performs Composio integration.
</verification>

<success_criteria>
- Unit tests enforce fixed lowercase names, namespacing, duplicate prevention, and built-in collision avoidance.
- Plugin initialization test fails on any startup `fetch` call.
- Local load integration test imports built `dist/index.js` and sees all registered tools.
- `smoke:local` runs after build and prints the registered tool count and local opencode config path.
- No deferred v2 per-app generation, hosted runtime, UI/dashboard, permission mutation, or version-management feature is introduced.
</success_criteria>

<output>
After completion, create `.planning/phases/01-package-skeleton-opencode-registration/01-package-skeleton-opencode-registration-03-SUMMARY.md`
</output>
