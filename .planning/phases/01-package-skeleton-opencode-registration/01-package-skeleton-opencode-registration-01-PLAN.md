---
phase: 01-package-skeleton-opencode-registration
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - tsconfig.json
  - tsup.config.ts
  - .gitignore
  - src/shared/version.ts
autonomous: true
must_haves:
  truths:
    - "Developer can install dependencies from a local checkout with Bun."
    - "Developer can run package scripts named test, typecheck, build, test:integration, and smoke:local from package.json."
    - "The package is ESM and exposes an opencode plugin entrypoint at dist/index.js after build."
  artifacts:
    - path: "package.json"
      provides: "Package metadata, ESM exports, dependencies, and required scripts"
      contains: "@opencode-ai/plugin"
    - path: "tsconfig.json"
      provides: "Strict TypeScript configuration for Bun/ESM package source"
      contains: "moduleResolution"
    - path: "tsup.config.ts"
      provides: "ESM and declaration build configuration for src/index.ts"
      contains: "dts"
    - path: "src/shared/version.ts"
      provides: "Runtime package version constant for later diagnostics"
      exports: ["PACKAGE_NAME", "PACKAGE_VERSION"]
  key_links:
    - from: "package.json"
      to: "src/index.ts"
      via: "exports import points at built dist/index.js generated from src/index.ts"
      pattern: '"exports"[\\s\\S]*"./dist/index.js"'
    - from: "package.json"
      to: "tsup.config.ts"
      via: "build script runs tsup configuration"
      pattern: '"build"[\\s\\S]*tsup'
---

<objective>
Create the local development package skeleton for `composio-x-opencode`.

Purpose: Phase 1 depends on a Bun/TypeScript/ESM package shape before plugin registration, tests, and smoke scripts can work.
Output: package metadata, dependency declarations, TypeScript/build configuration, git ignores, and a version helper.
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
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create ESM package metadata and required scripts</name>
  <files>package.json</files>
  <action>Create `package.json` for package name `composio-x-opencode`, version `0.1.0`, `type: "module"`, `main: "./dist/index.js"`, `types: "./dist/index.d.ts"`, and `exports["."].import/types` pointing at `./dist/index.js` and `./dist/index.d.ts`. Add `files: ["dist", "README.md", "LICENSE"]`, `engines` for Bun `>=1.3.10`, and scripts exactly covering `test`, `typecheck`, `build`, `test:integration`, `smoke:local`, and `pack:check`. Use `@opencode-ai/plugin@^1.15.0` and `zod@^4.4.3` as runtime dependencies. Use dev dependencies from research: `typescript@^6.0.3`, `@types/bun@^1.3.14`, `@types/node@^25.8.0`, `tsup@^8.5.1`, `publint@^0.3.21`, and `@opencode-ai/sdk@^1.15.0`. Do not add `@composio/core` in Phase 1 because startup must have no Composio network dependency and Composio runtime behavior starts in later phases.</action>
  <verify>`bun install` succeeds and `bun pm pkg get scripts` shows `test`, `typecheck`, `build`, `test:integration`, and `smoke:local`.</verify>
  <done>`package.json` is installable with Bun, declares the opencode plugin runtime dependency, and exposes all roadmap-required developer scripts.</done>
</task>

<task type="auto">
  <name>Task 2: Add strict TypeScript and tsup build configuration</name>
  <files>tsconfig.json, tsup.config.ts</files>
  <action>Create `tsconfig.json` using strict TypeScript, `target: "ES2022"`, ESM/bundler settings (`module: "ESNext"`, `moduleResolution: "Bundler"`), `types: ["bun", "node"]`, declaration-friendly settings, and include `src`, `test`, and `scripts`. Create `tsup.config.ts` that builds `src/index.ts` to ESM in `dist`, emits `.d.ts`, sourcemaps, cleans output, targets `es2022`, and externalizes runtime dependencies rather than bundling opencode internals.</action>
  <verify>`bunx tsc --showConfig` exits successfully and shows included source/test/script globs.</verify>
  <done>TypeScript and build config are ready for a strict ESM opencode plugin package.</done>
</task>

<task type="auto">
  <name>Task 3: Add repository ignores and package version helper</name>
  <files>.gitignore, src/shared/version.ts</files>
  <action>Create `.gitignore` covering `node_modules`, `dist`, coverage, temp files, `.env*`, Composio anonymous credential files, and Pi automation handoff files so secrets/local outputs are not committed. Create `src/shared/version.ts` exporting `PACKAGE_NAME = "composio-x-opencode"` and `PACKAGE_VERSION = "0.1.0"` as constants for later debug output; keep this helper network-free and independent of package.json filesystem reads.</action>
  <verify>`test -f .gitignore && test -f src/shared/version.ts` and `grep -E "node_modules|dist|anonymous_user_data|composio-automations" .gitignore` finds all required ignore patterns.</verify>
  <done>Generated outputs and local credentials are ignored, and source has a simple version constant available for later diagnostics.</done>
</task>

</tasks>

<verification>
Run `bun install`, `bun pm pkg get scripts`, and `bunx tsc --showConfig`. Do not expect full `bun run typecheck`, `bun run build`, or tests to pass until Plans 02 and 03 add the plugin entrypoint and test files.
</verification>

<success_criteria>
- `package.json` exists with ESM exports, required scripts, and Phase 1 dependency choices from research.
- TypeScript and tsup config exist and target `src/index.ts` -> `dist/index.js` with declarations.
- Secret/local output ignore patterns exist.
- No Composio SDK import or network-capable startup code is introduced.
</success_criteria>

<output>
After completion, create `.planning/phases/01-package-skeleton-opencode-registration/01-package-skeleton-opencode-registration-01-SUMMARY.md`
</output>
