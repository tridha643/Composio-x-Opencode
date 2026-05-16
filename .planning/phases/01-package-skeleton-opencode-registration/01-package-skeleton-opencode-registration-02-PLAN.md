---
phase: 01-package-skeleton-opencode-registration
plan: "02"
type: execute
wave: 2
depends_on:
  - 01-package-skeleton-opencode-registration-01
files_modified:
  - src/index.ts
  - src/plugin/manifest.ts
  - src/plugin/register-tools.ts
  - src/tools/names.ts
  - src/tools/static-placeholders.ts
autonomous: true
must_haves:
  truths:
    - "opencode can import the plugin entrypoint and receive a tool registry."
    - "The fixed v1 tool names are registered from a static manifest without Composio discovery."
    - "Plugin initialization performs no Composio network calls and does not require credentials."
    - "Tool names are stable, lowercase, and either composio_-prefixed or the documented save_automation_definition exception."
  artifacts:
    - path: "src/index.ts"
      provides: "Default @opencode-ai/plugin Plugin export"
      exports: ["default"]
    - path: "src/plugin/manifest.ts"
      provides: "Canonical static v1 tool manifest and metadata"
      exports: ["COMPOSIO_TOOL_MANIFEST", "COMPOSIO_TOOL_NAMES"]
    - path: "src/plugin/register-tools.ts"
      provides: "Manifest-to-opencode tool registry conversion"
      exports: ["buildComposioToolRegistry"]
    - path: "src/tools/static-placeholders.ts"
      provides: "Network-free Phase 1 execute handlers for all tools"
      exports: ["createPlaceholderTool"]
    - path: "src/tools/names.ts"
      provides: "Public registered tool name list for tests/docs"
      exports: ["REGISTERED_TOOL_NAMES"]
  key_links:
    - from: "src/index.ts"
      to: "src/plugin/register-tools.ts"
      via: "plugin returns tool registry built from static manifest"
      pattern: "buildComposioToolRegistry"
    - from: "src/plugin/register-tools.ts"
      to: "src/plugin/manifest.ts"
      via: "registry keys generated from COMPOSIO_TOOL_MANIFEST"
      pattern: "COMPOSIO_TOOL_MANIFEST"
    - from: "src/plugin/register-tools.ts"
      to: "@opencode-ai/plugin"
      via: "tool() helper wraps each manifest entry"
      pattern: "tool\\("
---

<objective>
Implement the loadable opencode plugin entrypoint and static v1 tool registration contract.

Purpose: opencode startup must expose the final v1 namespace without any Composio startup dependency, so later phases can fill behavior without renaming tools.
Output: default plugin export, static manifest, opencode tool registry builder, registered name export, and placeholder handlers.
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
@.planning/phases/01-package-skeleton-opencode-registration/01-package-skeleton-opencode-registration-01-SUMMARY.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Define the canonical static v1 tool manifest</name>
  <files>src/plugin/manifest.ts, src/tools/names.ts</files>
  <action>Create `src/plugin/manifest.ts` with a typed static manifest for exactly these public names, in this order: `composio_debug_info`, `composio_signup`, `composio_claim`, `composio_search_tools`, `composio_get_tool_schemas`, `composio_manage_connections`, `composio_multi_execute_tool`, `composio_remote_bash_tool`, `composio_remote_workbench`, `composio_list_trigger_types`, `composio_get_trigger_type_schema`, `composio_create_trigger`, `composio_list_triggers`, `composio_enable_trigger`, `composio_disable_trigger`, `composio_delete_trigger`, `save_automation_definition`. Include concise descriptions and metadata such as category/risk for later phases, but do not implement remote behavior. Document that `save_automation_definition` is the intentional non-`composio_` exception from the roadmap. Create `src/tools/names.ts` re-exporting `REGISTERED_TOOL_NAMES` from the manifest for tests/docs.</action>
  <verify>`grep -R "COMPOSIO_TOOL_NAMES\|REGISTERED_TOOL_NAMES\|save_automation_definition" src/plugin src/tools` finds the manifest and exported names.</verify>
  <done>The static manifest is the only source of public v1 tool names and contains all 17 required names with no generated/per-app tools.</done>
</task>

<task type="auto">
  <name>Task 2: Register manifest entries as network-free opencode tools</name>
  <files>src/plugin/register-tools.ts, src/tools/static-placeholders.ts</files>
  <action>Create `src/tools/static-placeholders.ts` with `createPlaceholderTool(manifestEntry)` returning an `@opencode-ai/plugin` `tool({ description, args, execute })`. Use empty/no-op args for Phase 1 and return structured placeholder output like `{ ok: false, code: "not_implemented_in_phase_1", tool: name, phase: 1, message }`. The one exception may be `composio_debug_info`, which can return `{ ok: true, registered: true, registeredTools: REGISTERED_TOOL_NAMES, packageName, packageVersion }` without credentials or network. Create `src/plugin/register-tools.ts` with `buildComposioToolRegistry()` converting `COMPOSIO_TOOL_MANIFEST` into an object keyed by the exact manifest names. Do not call `fetch`, import `@composio/core`, read credential files, or discover tools from Composio during module load or registration.</action>
  <verify>`grep -R "@composio/core\|fetch(\|agents.composio.dev\|backend.composio.dev" src` returns no matches, and `bun run typecheck` succeeds after Task 3.</verify>
  <done>Every manifest name maps to an opencode `tool()` definition, and all execute handlers are local placeholders suitable for startup without Composio credentials.</done>
</task>

<task type="auto">
  <name>Task 3: Export the default opencode Plugin entrypoint</name>
  <files>src/index.ts</files>
  <action>Create `src/index.ts` exporting `default plugin satisfies Plugin` from `@opencode-ai/plugin`. The plugin function should build and return `{ tool: buildComposioToolRegistry() }`. Optional logging through `ctx.client.app.log` is allowed only behind `.catch(() => undefined)` and must not block startup. Do not register commands in Phase 1; `/composio-claim` belongs to Phase 2. Do not mutate opencode permissions or config.</action>
  <verify>`bun run typecheck` and `bun run build` both succeed, producing `dist/index.js` and `dist/index.d.ts`.</verify>
  <done>The package has a valid ESM default opencode plugin export that registers the static tool namespace from local source only.</done>
</task>

</tasks>

<verification>
Run `bun run typecheck`, `bun run build`, and `grep -R "@composio/core\|fetch(\|agents.composio.dev\|backend.composio.dev" src` to verify compile/build success and no startup network implementation.
</verification>

<success_criteria>
- Importing `src/index.ts` or built `dist/index.js` exposes a default plugin function.
- Calling the plugin returns `tool` entries for all 17 fixed v1 names.
- No per-app generated tools, Composio discovery, signup, auth, or remote execution is implemented in Phase 1.
- `save_automation_definition` remains the only non-`composio_` public tool name.
</success_criteria>

<output>
After completion, create `.planning/phases/01-package-skeleton-opencode-registration/01-package-skeleton-opencode-registration-02-SUMMARY.md`
</output>
