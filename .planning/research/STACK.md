# Technology Stack

**Project:** composio-x-opencode  
**Dimension:** Stack for a publishable opencode plugin package exposing Composio-backed tools/commands  
**Researched:** 2026-05-15  
**Overall confidence:** HIGH for opencode/Bun/npm mechanics; MEDIUM for Composio low-level/meta-tool implementation details because the official docs prefer sessions and CLI workflows over hand-written meta-tool wrappers.

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| opencode plugin API via `@opencode-ai/plugin` | `1.15.0` | Primary extension surface: register plugin tools, add `/composio-claim` command config, hook logging/debug events if needed. | Current opencode docs explicitly support npm plugins, local TS/JS plugins, plugin-returned `tool` objects, and TypeScript types from `@opencode-ai/plugin`. This is the correct opencode-native path; do **not** port Pi extension APIs as if they were opencode APIs. | HIGH |
| opencode custom tool helper (`tool`, `tool.schema`) | Bundled in `@opencode-ai/plugin@1.15.0` | Define each Composio capability as a named opencode tool with Zod-validated args. | Official docs say plugin custom tools are registered with `tool({ description, args, execute })`; tool args use `tool.schema`/Zod and execute receives opencode session context. This gives the LLM typed tools without generating per-app opencode files. | HIGH |
| opencode SDK `@opencode-ai/sdk` | `1.15.0` | Integration/smoke testing against a real opencode server; optional runtime logging via `client.app.log()`. | Plugin context includes a client; SDK docs expose server creation, session prompt/command, events, and TUI APIs. Use it for tests and structured logging, not for tool registration. | HIGH |
| TypeScript | `6.0.3` | Source language and declaration generation. | The package must publish types and opencode plugin examples are TS-first. TS 6.0.3 is current on npm. Use strict ESM + declaration output. | HIGH |
| Bun runtime/package manager/test runner | `>=1.3.10` pinned in `engines`; current npm `bun-types` is `1.3.14` | Develop, test, run local opencode plugins, and align with opencode startup behavior. | opencode itself installs npm plugins with Bun at startup and docs use Bun shell APIs. Bun is also all-in-one runtime/package manager/test/bundler. Pin `>=1.3.10` because that is verified locally; allow newer 1.3.x. | HIGH |
| ESM npm package | package `type: "module"`; exports `./dist/index.js` + `.d.ts` | Publish a plugin module importable by opencode from npm. | `@opencode-ai/plugin` itself is ESM-only with `exports.import`; opencode plugin examples use ES module exports. Avoid CJS-first output. | HIGH |

### Composio Integration

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `@composio/core` | `0.10.0` | Composio SDK client for TypeScript: API key auth, session creation, trigger SDK, direct tool execution where required. | Current Composio docs say TypeScript integrations import `Composio` from `@composio/core`; SDK reference exposes `composio.triggers` methods for trigger lifecycle. Use the SDK where it has first-class methods. | HIGH |
| Composio meta tools API/reference | Current docs, no separate npm package | Source of schemas/descriptions for `COMPOSIO_GET_TOOL_SCHEMAS`, `COMPOSIO_MANAGE_CONNECTIONS`, `COMPOSIO_MULTI_EXECUTE_TOOL`, `COMPOSIO_REMOTE_BASH_TOOL`, `COMPOSIO_REMOTE_WORKBENCH`, `COMPOSIO_SEARCH_TOOLS`. | The project scope requires exposing the full meta-tool surface as opencode tools. Official docs list these as session-level system tools. Implement wrappers that call Composio’s current SDK/session or HTTP surface; keep the names stable. | MEDIUM |
| Composio trigger SDK (`composio.triggers`) | In `@composio/core@0.10.0` | `listTypes`, `getType`, `create`, `listActive`, `enable`, `disable`, `delete`, `update`, `verifyWebhook` as opencode tools. | Official TS SDK reference documents these methods. This should be the canonical implementation for trigger authoring/lifecycle rather than shelling out to CLI. | HIGH |
| Composio agent signup API | `https://agents.composio.dev/api/signup`, `/api/whoami`, `/api/claim`, `/api/cli` | First-use provisioning, anonymous credential storage, claim handoff. | Official Composio docs now describe exactly the required Pi-compatible flow: check `~/.composio/anonymous_user_data.json`, call signup, save response, use real `composio.api_key`, and claim via agent key. | HIGH |
| Composio CLI | Install script `curl -fsSL https://composio.dev/install | bash`; no npm package (`@composio/cli` not found) | Optional manual/debug parity, not runtime dependency. | CLI docs are rich for search/execute/listen/proxy/run and agent signup, but a publishable opencode plugin should not shell out to CLI for normal operation because users may not have it installed and there is no npm CLI package to depend on. | HIGH |

### Database

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| No database | N/A | This extension stores no app data. | Project scope is a runtime/plugin adapter. Persist only credentials in Composio’s existing anonymous-user JSON path and automation handoff JSON at the Pi-compatible path. Adding SQLite/Prisma creates migration/security burden without product value. | HIGH |
| JSON file storage via Node/Bun `fs` | Built-in | Read/write `~/.composio/anonymous_user_data.json` and `~/.config/pi/composio-automations.json`. | Required for Pi-compatible credential and automation handoff behavior. Use atomic writes (`write temp` → `rename`) and restrictive permissions for credential file. | HIGH |

### Infrastructure

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| npm package distribution | npm public registry | Publish installable plugin, e.g. `"plugin": ["composio-x-opencode"]`. | opencode docs explicitly support npm plugin specs in `opencode.json`; npm docs require `npm publish --access public` for scoped public packages. | HIGH |
| opencode config plugin entry | Current schema `plugin: (string | [string, object])[]` | User installation mechanism. | Official config schema confirms npm spec strings and tuple options. Use tuple options for optional defaults (automation file, user ID override, base URL), not environment-only configuration. | HIGH |
| GitHub Actions + npm trusted publishing/provenance | Current npm docs | CI typecheck/test/build/publint/pack and publish releases. | npm docs recommend provenance for GitHub Actions publishing and require 2FA or granular token. Prefer trusted publishing over long-lived npm tokens. | MEDIUM |

### Supporting Libraries

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| `zod` | `4.4.3` app-level; `@opencode-ai/plugin` currently depends on `zod@4.1.8` | Runtime validation for internal config, credential JSON, automation JSON, API responses. | Use `tool.schema` for tool args to match opencode; use direct `zod` for non-tool validation. Ensure one Zod major (v4) only. | HIGH |
| `@opencode-ai/plugin` | `1.15.0` | Types and helpers for plugin + tools. | Runtime dependency, not dev-only: opencode loads plugin code and imports helpers. | HIGH |
| `@opencode-ai/sdk` | `1.15.0` | Smoke/integration tests and optional logging types. | Dev dependency if only used in tests; avoid coupling runtime to SDK unless plugin context client types require it. | HIGH |
| `@composio/core` | `0.10.0` | SDK calls to Composio APIs. | Runtime dependency. Initialize lazily from resolved API key so `composio_signup` can run before credentials exist. | HIGH |
| `bun-types` | `1.3.14` | Type definitions for Bun globals (`Bun.$`, Bun test). | Dev dependency. Keep compatible with Bun engine. | HIGH |
| `@types/node` | `25.8.0` | Node built-in types for `fs`, `path`, `os`, `crypto`. | Dev dependency for filesystem/HTTP utilities. | HIGH |
| `tsup` | `8.5.1` | Build TypeScript to ESM `dist/` with declarations. | Use for publishable library builds because it reliably emits declarations and controls externalization; Bun can run/build but declaration generation still needs TS tooling. | MEDIUM |
| `publint` | `0.3.21` | Validate package `exports`, files, and type entries before publish. | Run in CI and `prepublishOnly`; catches broken npm package shapes that opencode would fail to import. | HIGH |
| Bun test | Bun `>=1.3.10` | Unit tests for credential resolution, signup flow, Composio wrappers, automation handoff, command/tool definitions. | Avoid Jest/Vitest unless browser/DOM features are needed. Bun test is TS-first and reduces dependency surface. | HIGH |

## Recommended Package Structure

Use one npm package with an ESM plugin entrypoint plus internal modules. Keep plugin registration separate from business logic so unit tests do not need opencode.

```text
composio-x-opencode/
  src/
    index.ts                     # default/named opencode Plugin export
    plugin/register-tools.ts      # maps stable tool names to tool() definitions
    plugin/register-commands.ts   # config mutation for /composio-claim if needed
    composio/client.ts            # lazy @composio/core initialization
    composio/meta-tools.ts        # meta-tool wrappers
    composio/triggers.ts          # trigger lifecycle wrappers
    composio/signup.ts            # agents.composio.dev signup/whoami/claim flow
    composio/credentials.ts       # COMPOSIO_API_KEY first, then anonymous JSON
    automation/handoff.ts         # Pi-compatible automation JSON append/read
    schemas/*.ts                  # zod schemas for files/API responses
    debug/info.ts                 # composio_debug_info payload
  test/
    unit/*.test.ts
    integration/*.test.ts         # real opencode/Composio tests gated by env vars
  examples/
    opencode.jsonc                # plugin config example
  dist/                           # generated, published
```

Recommended `package.json` shape:

```json
{
  "name": "composio-x-opencode",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist", "README.md", "LICENSE"],
  "engines": { "bun": ">=1.3.10", "node": ">=22" },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "bun test",
    "test:integration": "bun test test/integration --timeout 60000",
    "build": "tsup src/index.ts --format esm --dts --sourcemap --clean --target es2022",
    "pack:check": "publint && npm pack --dry-run",
    "prepublishOnly": "bun run typecheck && bun test && bun run build && bun run pack:check"
  },
  "dependencies": {
    "@composio/core": "^0.10.0",
    "@opencode-ai/plugin": "^1.15.0",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@opencode-ai/sdk": "^1.15.0",
    "@types/node": "^25.8.0",
    "bun-types": "^1.3.14",
    "publint": "^0.3.21",
    "tsup": "^8.5.1",
    "typescript": "^6.0.3"
  }
}
```

## API Boundary Decisions

| Boundary | Recommendation | Why | Confidence |
|----------|----------------|-----|------------|
| opencode plugin vs custom tool files | Publish an npm plugin that returns `tool: { ... }`, not a package that copies `.opencode/tools/*.ts` into user projects. | npm plugin install is opencode’s current distribution mechanism; plugin tools avoid file generation and keep upgrades centralized. | HIGH |
| opencode plugin vs Pi extension API | Recreate behavior, not API shape. Use opencode `Plugin` + `tool()` + command config; keep only Pi-compatible automation file path/format. | Pi extension APIs are not opencode APIs. opencode plugin/custom-tool docs define a distinct surface. | HIGH |
| Composio SDK vs CLI | Use `@composio/core` and signup HTTP APIs at runtime; reserve CLI for documentation and manual debugging. | CLI may be absent; docs state CLI install is curl-based and npm registry has no `@composio/cli`. SDK has TS trigger APIs. | HIGH |
| Meta tools implementation | Expose stable opencode tool names matching Composio meta-tool names; internally call current Composio SDK/session/direct APIs and keep request/response passthrough as close to docs as possible. | Scope requires meta tools exactly; Composio docs list meta tools as session-level tools, not a separate package. Needs implementation validation against live API. | MEDIUM |
| Credentials | Resolution order: `COMPOSIO_API_KEY` → `~/.composio/anonymous_user_data.json` `composio.api_key`; signup writes anonymous JSON. | Matches project requirement and official signup docs. Never persist `COMPOSIO_API_KEY` into project config. | HIGH |
| Automation handoff | Default `~/.config/pi/composio-automations.json`; override `PI_COMPOSIO_AUTOMATIONS_JSON`; per-call `filePath` wins. | Required Pi-compatible path; JSON file is out-of-scope to redesign. | HIGH |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not | Confidence |
|----------|-------------|-------------|---------|------------|
| Extension mechanism | opencode npm plugin | MCP server | MCP is useful for tool interoperability, but project specifically needs opencode tools/commands and signup/claim/debug behaviors. MCP would add another process and would not naturally provide `/composio-claim`. | HIGH |
| Extension mechanism | opencode npm plugin | Generate `.opencode/tools/*.ts` files | Harder to upgrade, pollutes user projects, and risks tool-name collisions. Plugin tools are first-class and central. | HIGH |
| Runtime API | `@composio/core` + signup HTTP | Shell out to `composio` CLI | CLI is not guaranteed installed, less testable, no npm package found, and subprocess auth/output parsing is brittle. | HIGH |
| Build tool | `tsup` + `tsc --noEmit` | Bun build only | Bun build is excellent for executables but does not replace TypeScript declaration publishing workflows as cleanly. opencode needs importable JS + types, not a compiled binary. | MEDIUM |
| Test runner | Bun test | Vitest/Jest | Bun test is native to the stack, TS-first, and adequate for filesystem/HTTP/plugin unit tests. Extra runners add dependency overhead. | HIGH |
| Validation | Zod v4 | Ajv/Valibot | opencode tool schemas are already Zod-based via `tool.schema`; reusing Zod prevents schema translation layers. | HIGH |
| Package format | ESM-only | Dual ESM/CJS | opencode and `@opencode-ai/plugin` are ESM-oriented; dual output increases export/test complexity without a known consumer need. | HIGH |
| Generated Composio types | Handwritten wrappers around meta/session APIs | `composio generate` per toolkit | Scope explicitly excludes per-app opencode tool generation. Meta tools and trigger lifecycle are dynamic; generated per-tool stubs are unnecessary. | HIGH |

## Installation

```bash
# Runtime dependencies
bun add @opencode-ai/plugin@^1.15.0 @composio/core@^0.10.0 zod@^4.4.3

# Dev dependencies
bun add -d typescript@^6.0.3 bun-types@^1.3.14 @types/node@^25.8.0 tsup@^8.5.1 publint@^0.3.21 @opencode-ai/sdk@^1.15.0
```

User installation example:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    ["composio-x-opencode", {
      "automationFile": "~/.config/pi/composio-automations.json"
    }]
  ]
}
```

For local smoke testing before publish:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["./dist/index.js"]
}
```

## Testing and Release Gates

| Gate | Command | Required Coverage |
|------|---------|-------------------|
| Typecheck | `bun run typecheck` | Plugin export, tool arg schemas, Composio wrapper types, file schemas. |
| Unit tests | `bun test` | Credential precedence; anonymous JSON parsing; signup/whoami/claim mocked HTTP; automation handoff path precedence; trigger wrapper method calls; meta-tool request shaping; debug info redaction. |
| Build | `bun run build` | ESM output and `.d.ts`. |
| Package validation | `publint && npm pack --dry-run` | Exports/files are publishable; secrets and test fixtures excluded. |
| opencode smoke | Run opencode with local `./dist/index.js` plugin | Verify tools appear, `composio_debug_info` runs without credentials, `composio_signup` creates/uses credentials, `/composio-claim <email>` invokes claim flow. |
| Composio live integration | `COMPOSIO_API_KEY=... bun run test:integration` | Search/get schemas, one safe read-only tool execution, trigger type list/get schema. Destructive/remote-bash tests gated separately. |

## What NOT To Use

- Do **not** use Pi extension APIs as the host integration layer. Only the behavior and automation handoff file remain Pi-compatible.
- Do **not** require users to manually run `composio login` or create auth configs before first use. Official Composio guidance says agents can sign up and should not require manual pre-setup.
- Do **not** depend on an npm `@composio/cli` package; npm returned 404. Treat CLI as external/manual.
- Do **not** generate one opencode tool per Composio app/toolkit. Scope is meta tools + trigger authoring, not per-app codegen.
- Do **not** publish credentials, `.env`, anonymous user data, or automation files. Keep `.npmignore`/`files` strict and run `npm pack --dry-run`.
- Do **not** override opencode built-in tools such as `bash` unless intentionally designing a replacement. Use unique `composio_*`/`COMPOSIO_*` names.

## Sources

- HIGH — opencode Plugins docs, last updated 2026-05-15: https://opencode.ai/docs/plugins/
- HIGH — opencode Custom Tools docs, last updated 2026-05-15: https://opencode.ai/docs/custom-tools/
- HIGH — opencode Commands docs, last updated 2026-05-15: https://opencode.ai/docs/commands/
- HIGH — opencode SDK docs, last updated 2026-05-15: https://opencode.ai/docs/sdk/
- HIGH — opencode config JSON schema: https://opencode.ai/config.json
- HIGH — npm registry package metadata checked 2026-05-15: `@opencode-ai/plugin@1.15.0`, `@opencode-ai/sdk@1.15.0`, `opencode-ai@1.15.0`, `@composio/core@0.10.0`, `typescript@6.0.3`, `bun-types@1.3.14`, `zod@4.4.3`, `tsup@8.5.1`, `publint@0.3.21`.
- HIGH — Bun docs overview/runtime/test/bundler: https://bun.sh/docs and executable build docs: https://bun.com/docs/bundler/executables
- HIGH — Composio docs index/current SDK guardrails: https://docs.composio.dev/llms.txt
- HIGH — Composio CLI docs: https://docs.composio.dev/docs/cli
- HIGH — Composio signing up as an agent: https://docs.composio.dev/docs/signing-up-as-an-agent.md
- HIGH — Composio triggers overview: https://docs.composio.dev/docs/triggers
- HIGH — Composio TypeScript triggers SDK reference: https://docs.composio.dev/reference/sdk-reference/typescript/triggers.md
- MEDIUM — Composio meta tools reference: https://docs.composio.dev/reference/meta-tools.md
- HIGH — npm scoped public publishing docs, last edited 2025-12-10: https://docs.npmjs.com/creating-and-publishing-scoped-public-packages
