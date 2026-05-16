# Phase 1: Package Skeleton & opencode Registration - Research

**Researched:** 2026-05-15  
**Domain:** opencode plugin package skeleton, Bun/TypeScript ESM packaging, static tool registration  
**Confidence:** HIGH

## Summary

Phase 1 should create the smallest loadable `composio-x-opencode` package that proves opencode can import the plugin and see the fixed v1 tool namespace without touching Composio. Current opencode docs verify that plugins are JavaScript/TypeScript modules exporting plugin functions, npm plugins are configured through the `plugin` array, local plugins can be loaded from file paths or `.opencode/plugins/`, and plugin-returned `tool: { ... }` objects register custom tools created with `tool()` from `@opencode-ai/plugin`.

The phase should focus on package shape, static registration, naming contracts, and developer scripts. Do not implement Composio API behavior here beyond inert/lazy scaffolding. Tool execute handlers can return explicit `not_implemented_in_phase_1` / `requires_later_phase` responses or call local-only placeholders, but registration must include the final v1 names so later phases fill behavior without renaming tools.

**Primary recommendation:** Build an ESM Bun/TypeScript package exporting a default `Plugin`, register every v1 tool from a single static manifest via `@opencode-ai/plugin` `tool()`, and keep all Composio clients/network imports behind lazy execute-time factories.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@opencode-ai/plugin` | `1.15.0` | Plugin type and `tool()` helper for opencode custom tools | Official opencode plugin/custom-tool docs use this package; npm metadata confirms ESM exports and bundled Zod dependency. |
| Bun | `>=1.3.10` engine; types via `@types/bun@1.3.14` | Package manager, local runtime, test runner, opencode-compatible startup environment | opencode installs npm plugin dependencies using Bun at startup; Bun test runs TypeScript directly. Official Bun docs now recommend `@types/bun` for TypeScript projects. |
| TypeScript | `6.0.3` | Strict source types and declaration output | Current npm latest; opencode plugin examples are TypeScript-first. Use `strict`, `moduleResolution: "bundler"`, ESM output. |
| `zod` / `tool.schema` | `zod@4.4.3`; `@opencode-ai/plugin` depends on `zod@4.1.8` | Tool argument schemas and static manifest validation | opencode tool schemas are Zod-based; avoid schema translation layers. For Phase 1, prefer `tool.schema` for args. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tsup` | `8.5.1` | Build `src/index.ts` to ESM `dist/index.js` and `.d.ts` | Use for publishable package builds because Bun bundler docs explicitly say Bun build is not a replacement for typechecking/declaration generation. |
| `publint` | `0.3.21` | Validate package exports/files shape | Add script now even if npm release is Phase 8; broken exports are a Phase 1 loadability risk. |
| `@opencode-ai/sdk` | `1.15.0` | Later integration/smoke helpers | Keep dev-only in Phase 1 unless runtime plugin code imports SDK types directly. Plugin context already includes `client`. |
| `@types/node` | `25.8.0` | Node/Bun built-in module types | Needed for package metadata, filesystem/path utilities, smoke scripts. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| opencode plugin package | `.opencode/tools/*.ts` generated files | Violates package goal, harder to upgrade, and file-derived tool names increase collision risk. |
| Static v1 tool manifest | Generate tools from Composio at startup | Violates RUNT-01 no-network startup and roadmap decision to avoid per-app generated tools. |
| `tsup` declarations | Bun build only | Bun build is fast but official docs say it is not intended to replace `tsc` for typechecking/declaration output. |
| Bun test | Vitest/Jest | Extra dependency surface; Bun test is TS-capable and enough for manifest/package tests. |
| `bun-types` | `@types/bun` | `bun-types` exists on npm, but current Bun docs recommend `@types/bun`; use `@types/bun` unless package install proves incompatible. |

**Installation:**
```bash
bun add @opencode-ai/plugin@^1.15.0 zod@^4.4.3
bun add -d typescript@^6.0.3 @types/bun@^1.3.14 @types/node@^25.8.0 tsup@^8.5.1 publint@^0.3.21 @opencode-ai/sdk@^1.15.0
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── index.ts                  # default Plugin export only
├── plugin/
│   ├── manifest.ts           # canonical v1 tool names/descriptions/risk metadata
│   ├── register-tools.ts     # converts manifest to opencode tool definitions
│   └── smoke.ts              # local smoke helpers if needed, no Composio calls
├── tools/
│   ├── static-placeholders.ts # Phase 1 placeholder execute handlers
│   └── names.ts              # exported REGISTERED_TOOL_NAMES for tests/docs
├── shared/
│   └── version.ts            # package version helper, no network
test/
├── unit/
│   ├── manifest.test.ts      # names lowercase/prefixed/no collisions
│   └── plugin-export.test.ts # plugin returns tool registry
└── integration/
    └── local-load.test.ts    # gated/optional opencode local smoke
examples/
└── opencode.local.jsonc      # plugin ["./dist/index.js"] example
scripts/
└── smoke-local.ts            # builds and starts/runs opencode with local plugin
```

### Pattern 1: Static Manifest as the Naming Contract
**What:** Define all public tool names in one constant manifest and generate tool registration/tests/docs from it.  
**When to use:** Phase 1 and every later phase that fills implementation.  
**Example:**
```typescript
// Source: opencode plugin custom tools docs, https://opencode.ai/docs/plugins/
// and project roadmap RUNT-03 naming requirements.
export const COMPOSIO_TOOL_NAMES = [
  "composio_debug_info",
  "composio_signup",
  "composio_claim",
  "composio_search_tools",
  "composio_get_tool_schemas",
  "composio_manage_connections",
  "composio_multi_execute_tool",
  "composio_remote_bash_tool",
  "composio_remote_workbench",
  "composio_list_trigger_types",
  "composio_get_trigger_type_schema",
  "composio_create_trigger",
  "composio_list_triggers",
  "composio_enable_trigger",
  "composio_disable_trigger",
  "composio_delete_trigger",
  "save_automation_definition",
] as const
```

**Note:** `save_automation_definition` is intentionally not `composio_`-prefixed because the roadmap success criteria explicitly names `composio_` / `save_automation_definition` as the v1 surface.

### Pattern 2: Plugin Function Returns Tool Registry, Not Side Effects
**What:** Export an async plugin function typed with `Plugin`; build and return `tool: { [name]: tool(...) }`.  
**When to use:** Always for Phase 1 loadability.  
**Example:**
```typescript
// Source: official opencode Plugins docs, Custom tools example.
import { type Plugin, tool } from "@opencode-ai/plugin"
import { COMPOSIO_TOOL_NAMES } from "./plugin/manifest"

const plugin = (async ({ client }) => {
  await client.app.log({
    body: { service: "composio-x-opencode", level: "info", message: "plugin loaded" },
  }).catch(() => undefined)

  return {
    tool: Object.fromEntries(
      COMPOSIO_TOOL_NAMES.map((name) => [
        name,
        tool({
          description: `Registered placeholder for ${name}; implementation arrives in later composio-x-opencode phases.`,
          args: {},
          async execute() {
            return { ok: false, code: "not_implemented_in_phase_1", tool: name }
          },
        }),
      ]),
    ),
  }
}) satisfies Plugin

export default plugin
```

### Pattern 3: Lazy Network Boundary
**What:** Phase 1 package code may import no Composio SDK at all, or it may isolate `@composio/core` behind a dynamic import/factory not called during plugin initialization.  
**When to use:** Any future Composio-backed service.  
**Example:**
```typescript
// Source: RUNT-01 no startup network calls; official opencode plugins run at startup.
export async function createComposioClientAtExecuteTime(apiKey: string) {
  const { Composio } = await import("@composio/core")
  return new Composio({ apiKey })
}
```

### Pattern 4: Script Contract First
**What:** Add all roadmap-required scripts immediately, even where some are placeholders/gated in Phase 1.  
**When to use:** Package skeleton.  
**Example package scripts:**
```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "bun test test/unit",
    "build": "tsup src/index.ts --format esm --dts --sourcemap --clean --target es2022",
    "test:integration": "bun test test/integration --timeout 60000",
    "smoke:local": "bun run build && bun scripts/smoke-local.ts",
    "pack:check": "publint && npm pack --dry-run"
  }
}
```

### Anti-Patterns to Avoid
- **Network at module top-level or plugin initialization:** opencode executes plugin functions at startup; any signup/session/schema call here violates RUNT-01 and makes startup flaky.
- **Tool names derived from filenames/exports:** plugin-level `tool` registry should use explicit manifest keys. File-derived naming (`<filename>_<exportname>`) is for `.opencode/tools` and can surprise planners.
- **Generic names:** never register `search`, `debug`, `bash`, `claim`, `delete`, or `trigger_delete`; custom tools can override built-ins if names collide.
- **Runtime imports left in devDependencies:** if Phase 1 imports `@opencode-ai/plugin` at runtime, it belongs in `dependencies`.
- **Skipping local smoke because unit tests pass:** tests can validate object shape, but only opencode startup proves plugin loading.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| opencode tool schema validation | Custom JSON Schema validator | `tool()` + `tool.schema` / Zod | Official API expects Zod-like schemas and produces opencode-compatible tool definitions. |
| Package declaration/build pipeline | Custom `tsc` emit scripts with hand-copied files | `tsup` for ESM+d.ts plus `tsc --noEmit` | Reduces broken exports and missing declarations. |
| Test runner | Homemade assertion harness | `bun test` | Built-in TS support, mocks, timeouts, CI integration. |
| Plugin install/load config | Generated opencode config mutator | Document/copy a small `opencode.jsonc` and use `OPENCODE_CONFIG_CONTENT` in smoke | Avoids surprising user config mutation; schema is strict. |
| Tool naming checks | Manual checklist only | Manifest unit test with regex/collision denylist | Prevents later phases from accidentally changing public names. |

**Key insight:** Phase 1 is a contract phase. The planner should prioritize a small, verifiable package shape over feature behavior; all complex Composio work belongs behind later execute-time service boundaries.

## Common Pitfalls

### Pitfall 1: Wrong plugin export shape
**What goes wrong:** Package exports a plain object, CommonJS build, or missing default/named plugin function, so opencode imports but does not run registration.  
**Why it happens:** Confusing plugin hooks object with plugin function return value.  
**How to avoid:** Export `default (async (...) => ({ tool: ... })) satisfies Plugin`; build ESM; test importing `dist/index.js`.  
**Warning signs:** Unit tests only inspect source constants; no test calls the exported plugin function.

### Pitfall 2: Startup network calls
**What goes wrong:** opencode startup creates Composio clients/sessions, fetches schemas, signs up users, or checks credentials.  
**Why it happens:** Treating registration as discovery instead of static declaration.  
**How to avoid:** Static manifest only; no `fetch`/Composio SDK execution outside tool `execute`. Add a test that monkey-patches `globalThis.fetch` and asserts plugin initialization does not call it.  
**Warning signs:** `src/index.ts` imports a service that runs environment/auth/session code at top level.

### Pitfall 3: Name collisions and unstable tool spellings
**What goes wrong:** A custom tool overrides opencode `bash`/`read` or the same Composio action appears under multiple names.  
**Why it happens:** Filename/export-derived tools, generic names, or mixing upstream uppercase Composio slugs with opencode tool names.  
**How to avoid:** Static manifest test: all names match `/^[a-z][a-z0-9_]*$/`; all except `save_automation_definition` start with `composio_`; deny known built-ins/generic names; no duplicates.  
**Warning signs:** README/examples mention `COMPOSIO_SEARCH_TOOLS` as an opencode-visible name.

### Pitfall 4: Broken local checkout loading
**What goes wrong:** Plugin works from source in tests but opencode local plugin path cannot import it because dependencies are missing or build output path differs.  
**Why it happens:** Local plugin dependency rules differ from npm package install; opencode local files need a package context for external dependencies.  
**How to avoid:** Smoke the built `./dist/index.js` path from a temporary opencode config, not only `.opencode/plugins/src.ts`; document local use after `bun install && bun run build`.  
**Warning signs:** Example config points to `./src/index.ts` while package only validates `dist/`.

### Pitfall 5: Invalid opencode config/command examples
**What goes wrong:** Smoke config fails strict schema validation before plugin load.  
**Why it happens:** opencode config changed from older examples; current schema uses `plugin: []` and command entries with required `template`.  
**How to avoid:** Validate examples against `https://opencode.ai/config.json`; include `$schema`; avoid Phase 1 command registration unless needed.  
**Warning signs:** Config uses `plugins` object or `prompt` instead of `template` for commands.

## Code Examples

Verified patterns from official sources:

### Minimal opencode plugin with custom tool
```typescript
// Source: https://opencode.ai/docs/plugins/ (Custom tools example)
import { type Plugin, tool } from "@opencode-ai/plugin"

export default (async () => {
  return {
    tool: {
      composio_debug_info: tool({
        description: "Show composio-x-opencode registration diagnostics without contacting Composio.",
        args: {},
        async execute(_args, context) {
          return {
            ok: true,
            sessionID: context.sessionID,
            registered: true,
          }
        },
      }),
    },
  }
}) satisfies Plugin
```

### Current opencode local plugin config shape
```jsonc
// Source: https://opencode.ai/docs/config/ and https://opencode.ai/config.json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["./dist/index.js"]
}
```

### Tool naming test
```typescript
// Source: project RUNT-03 + opencode custom-tool collision docs.
import { describe, expect, test } from "bun:test"
import { COMPOSIO_TOOL_NAMES } from "../../src/plugin/manifest"

const forbidden = new Set(["bash", "read", "write", "edit", "search", "debug", "delete", "claim"])

describe("tool naming contract", () => {
  test("names are stable lowercase and namespaced", () => {
    expect(new Set(COMPOSIO_TOOL_NAMES).size).toBe(COMPOSIO_TOOL_NAMES.length)
    for (const name of COMPOSIO_TOOL_NAMES) {
      expect(name).toMatch(/^[a-z][a-z0-9_]*$/)
      expect(forbidden.has(name)).toBe(false)
      if (name !== "save_automation_definition") expect(name.startsWith("composio_")).toBe(true)
    }
  })
})
```

### No-network startup test
```typescript
// Source: RUNT-01; validates plugin initialization only.
import { expect, test } from "bun:test"
import plugin from "../../src/index"

test("plugin initialization registers tools without fetch", async () => {
  const originalFetch = globalThis.fetch
  let fetchCalled = false
  globalThis.fetch = ((..._args: Parameters<typeof fetch>) => {
    fetchCalled = true
    throw new Error("fetch should not run during plugin initialization")
  }) as typeof fetch

  try {
    const hooks = await plugin({
      client: { app: { log: async () => ({}) } },
      project: {},
      directory: process.cwd(),
      worktree: process.cwd(),
      $: Bun.$,
    } as never)
    expect(Object.keys(hooks.tool ?? {}).length).toBeGreaterThan(0)
    expect(fetchCalled).toBe(false)
  } finally {
    globalThis.fetch = originalFetch
  }
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Local custom tools only in `.opencode/tools` | npm/local plugins can return `tool: { ... }` | Verified opencode docs updated May 15, 2026 | Package can register all tools centrally without copying files into user projects. |
| Config examples with loose/unknown fields | Strict `opencode.ai/config.json` schema, `plugin` array, command `template` | Current schema fetched May 15, 2026 | Smoke examples must be schema-valid or startup fails before plugin loads. |
| `bun-types` as the common Bun type package | Bun docs recommend `@types/bun` | Current Bun docs fetched May 15, 2026 | Prefer `@types/bun`; only fall back to `bun-types` if implementation tooling requires it. |
| Bun build as a universal build tool | Use Bun runtime/test, but `tsup`/`tsc` for package declarations | Bun bundler docs state it is not a replacement for typechecking/declarations | Phase 1 should include `tsc --noEmit` and declaration-generating build. |

**Deprecated/outdated:**
- `tools` agent config for enabling/disabling tools is marked deprecated in current config schema; use `permission` for docs later.
- Command config `prompt` is not current schema; use `template` if Phase 1 adds command examples.
- Source-generated per-app opencode tools are deferred v2/out of scope.

## Open Questions

1. **Exact opencode CLI smoke command for enumerating plugin tools**
   - What we know: official docs verify plugin loading and config shapes; opencode SDK/CLI can run sessions.
   - What's unclear: the most stable non-interactive command/API to assert tool names in CI without brittle TUI scraping.
   - Recommendation: Phase 1 planner should make local smoke minimal: build, run opencode with temporary config, call `composio_debug_info` placeholder or import plugin directly if CLI enumeration is unavailable. Keep a manual smoke checklist until Phase 7 hardens integration.

2. **Whether `@composio/core` belongs in Phase 1 dependencies**
   - What we know: later phases require it; Phase 1 must not call Composio at startup.
   - What's unclear: whether adding it now is useful or just widens install risk.
   - Recommendation: do not import/use `@composio/core` in Phase 1. It may be added as a runtime dependency now only if roadmap wants full dependency skeleton; otherwise defer to Phase 2/3.

## Sources

### Primary (HIGH confidence)
- Official opencode Plugins docs, fetched 2026-05-15, last updated 2026-05-15 — plugin config, local/npm plugin loading, Bun install/cache, plugin function shape, custom tools, logging: https://opencode.ai/docs/plugins/
- Official opencode Custom Tools docs, fetched 2026-05-15, last updated 2026-05-15 — `tool()` helper, `tool.schema`, context fields, filename/export naming, built-in collision behavior: https://opencode.ai/docs/custom-tools/
- Official opencode Config docs and schema, fetched 2026-05-15 — `plugin` array, command `template`, strict additional properties, config locations/precedence, `OPENCODE_CONFIG_CONTENT`: https://opencode.ai/docs/config/ and https://opencode.ai/config.json
- Official Bun TypeScript docs, fetched 2026-05-15 — install `@types/bun`, recommended TS compiler options: https://bun.sh/docs/runtime/typescript
- Official Bun test docs, fetched 2026-05-15 — TS test runner, patterns, timeout, mocks, CI behavior: https://bun.com/docs/test
- Official Bun bundler docs, fetched 2026-05-15 — build API and explicit note that Bun bundler is not a replacement for `tsc` typechecking/declaration generation: https://bun.com/docs/bundler
- npm registry metadata checked 2026-05-15 via `npm view` — `@opencode-ai/plugin@1.15.0`, `@opencode-ai/sdk@1.15.0`, `typescript@6.0.3`, `@types/bun@1.3.14`, `@types/node@25.8.0`, `zod@4.4.3`, `tsup@8.5.1`, `publint@0.3.21`, `@composio/core@0.10.0`.

### Secondary (MEDIUM confidence)
- Existing project research in `.planning/research/STACK.md`, `.planning/research/ARCHITECTURE.md`, `.planning/research/PITFALLS.md` — useful synthesis; current Phase 1 conclusions were re-verified against official opencode/Bun docs where critical.

### Tertiary (LOW confidence)
- None used for Phase 1 recommendations.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — current official opencode/Bun docs and npm registry metadata align.
- Architecture: HIGH — plugin registration/static manifest/no-network boundary are directly supported by opencode docs and roadmap requirements.
- Pitfalls: HIGH — common failure modes are documented in official opencode behavior: strict config, startup plugin load, custom tool collision, local dependency rules.

**Research date:** 2026-05-15  
**Valid until:** 2026-06-14 for package skeleton choices; re-check opencode plugin docs/package versions before release or if implementation starts after 30 days.
