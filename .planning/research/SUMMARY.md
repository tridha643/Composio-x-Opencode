# Project Research Summary

**Project:** composio-x-opencode  
**Domain:** publishable opencode plugin for Composio meta tools, trigger lifecycle APIs, first-use signup/claim, and Pi-compatible automation handoff  
**Researched:** 2026-05-15  
**Confidence:** MEDIUM-HIGH

## Executive Summary

`composio-x-opencode` should be built as a single npm-distributed opencode plugin, not an MCP server, generated tool pack, or Pi API port. Experts would keep the opencode layer thin: register a bounded set of custom tools and one `/composio-claim` command, then delegate credential resolution, Composio API calls, trigger lifecycle, automation file writes, safety policy, and debug reporting to framework-agnostic service modules.

The recommended v1 surface is static and explicit: six Composio meta/runtime tools, trigger discovery/schema/upsert/list/manage/delete tools, `composio_signup`, `composio_claim`, `save_automation_definition`, and `composio_debug_info`. Use TypeScript, ESM, Bun, `@opencode-ai/plugin`, `@composio/core`, Zod, `tsup`, and strict npm pack validation. Do not generate one tool per Composio app; use Composio search/schema/execute flows at runtime.

The largest risks are security and compatibility: destructive remote/mutation tools can be over-exposed, credentials can leak into model context or npm packages, and Pi-compatible automation handoff can break if the file path/format is “improved.” Mitigate with explicit risky tool names/descriptions, recommended opencode permission snippets, centralized redaction, `files` allowlisting plus `npm pack` checks, atomic JSON writes, and live integration tests gated by `COMPOSIO_API_KEY`.

## Key Findings

### Recommended Stack

Use opencode’s native plugin/custom-tool API as the extension boundary and keep all runtime behavior in an ESM TypeScript npm package. Bun is the development/test/install runtime alignment point because opencode installs npm plugins with Bun, while `tsup`/TypeScript remain necessary for declaration-bearing package output.

Composio integration should use `@composio/core` and documented HTTP endpoints directly at runtime, not the CLI. The CLI is useful for manual parity/debugging but is not an npm runtime dependency and may not be installed for users.

**Core technologies:**
- `@opencode-ai/plugin@1.15.0` — plugin export, config hook, and Zod-backed custom tool registration.
- `@opencode-ai/sdk@1.15.0` — smoke/integration testing and optional structured logging, not primary registration.
- TypeScript `6.0.3` + ESM package output — publishable typed npm module compatible with opencode’s ESM plugin model.
- Bun `>=1.3.10` — package manager, test runner, and local smoke runtime aligned with opencode startup behavior.
- `@composio/core@0.10.0` — Composio SDK client, especially trigger SDK/lifecycle capabilities.
- Composio v3.1 HTTP/meta-tool endpoints — required for tool-router sessions and execution of the six meta tools.
- Zod `4.x` / `tool.schema` — one validation model for opencode tool arguments and internal schemas.
- `tsup` + `publint` + `npm pack --dry-run` — release gates for correct package exports and safe tarball contents.
- No database — persist only the required anonymous credential JSON and Pi-compatible automation handoff JSON via atomic filesystem writes.

### Expected Features

The product is only complete if it delivers both Composio’s dynamic meta-tool surface and Pi-compatible onboarding/handoff behavior inside opencode. The agent workflow should be schema-first: search tools/triggers, inspect schemas, manage connections when required, then execute/upsert.

**Must have (table stakes):**
- npm-installable opencode plugin package plus documented local development smoke path.
- Fixed opencode tool registration for all six Composio meta/runtime tools: search, get schemas, manage connections, multi-execute, remote bash, and remote workbench.
- Trigger lifecycle tools: list trigger types, get trigger schema, create/upsert, list active instances, enable, disable, and delete.
- Credential resolver with precedence `COMPOSIO_API_KEY` → `~/.composio/anonymous_user_data.json`.
- `composio_signup` with anonymous credential persistence and `composio_claim` plus `/composio-claim <email>` command path.
- `save_automation_definition` writing Pi-compatible records to `filePath` → `PI_COMPOSIO_AUTOMATIONS_JSON` → `~/.config/pi/composio-automations.json`.
- `composio_debug_info` with redacted auth source, registered tool names, package/runtime info, and handoff path.
- Safety-oriented descriptions, permission snippets, tests, typecheck, build, package validation, and manual opencode smoke testing.

**Should have (competitive):**
- Graceful zero-setup onboarding that suggests or performs signup when credentials are missing.
- Dual human/agent claim flow via slash command and tool.
- Agent workflow recipes in docs for tool execution and trigger authoring.
- Idempotent trigger/handoff helpers that avoid duplicate automations.
- Rich, redacted diagnostics and optional non-destructive API reachability checks.
- Versioned compatibility notes with `composio-x-pi` handoff behavior.

**Defer (v2+):**
- Per-app opencode tool generation.
- Hosted webhook receiver/event runner.
- UI/dashboard.
- Automatic mutation of user opencode permission config.
- Advanced trigger version pinning UI/config until exact API behavior is validated.

### Architecture Approach

Use a thin-adapter, stable-core architecture. The plugin export should synchronously register tool definitions and inject a command template, but all network and filesystem mutation should happen lazily on first tool use. Public opencode tool names should be lowercase snake_case and prefixed with `composio_`, while upstream Composio meta-tool slugs remain uppercase inside service calls.

**Major components:**
1. `src/plugin.ts` opencode adapter — exports the plugin, creates services, registers tools, injects `/composio-claim`, and logs through opencode.
2. `src/tools/*` — tool schemas, descriptions, safety metadata, and execute handlers for meta tools, triggers, auth, debug, and handoff.
3. `src/auth/*` — credential resolver, signup service, and claim service with explicit auth state and redaction.
4. `src/composio/client.ts` and `tool-router.ts` — low-level HTTP client, timeout/error normalization, per-opencode-session tool-router cache, and `execute_meta` calls.
5. `src/composio/triggers.ts` — trigger type discovery and trigger instance lifecycle over v3.1 endpoints or SDK methods.
6. `src/automation/handoff-store.ts` — Pi-compatible path resolution, validation, preservation of records, and atomic read-modify-write.
7. `src/safety/policies.ts` — risk classification, warnings, confirmation checks, and guardrails that do not rely solely on opencode permissions.
8. `src/debug/debug-info.ts` — redacted support surface for credentials, paths, versions, tool registration, and recent normalized errors.

### Critical Pitfalls

1. **Destructive Composio tools exposed as ordinary tools** — classify risk, use explicit names/descriptions, require `confirm: true` for irreversible actions where feasible, and ship permission snippets that set high-risk tools to `ask` or `deny`.
2. **Credential leakage through debug, logs, tests, or npm publishing** — centralize auth, redact every output/error/log path, write anonymous credentials with restrictive permissions, and verify package contents with an allowlisted `files` config plus pack inspection.
3. **Breaking Pi-compatible automation handoff** — treat `~/.config/pi/composio-automations.json` and its shape as an external contract; preserve unknown fields, honor path precedence, and write atomically.
4. **Disable/delete confusion and trigger leaks** — make disable the default pause operation, require exact `triggerId` and confirmation for delete, list/filter before upsert, and test repeated upsert for idempotency.
5. **Schema drift from guessed or hardcoded Composio slugs/versions** — always search/list and fetch schemas at runtime, return version metadata when available, and add contract tests against safe live tools/triggers.
6. **Broken opencode/npm packaging assumptions** — validate plugin export shape, runtime dependencies, `exports`, `files`, and fresh opencode loading from a packed tarball.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Package Skeleton, Plugin Registration, and Naming Contract
**Rationale:** Every feature depends on opencode successfully loading the npm/local plugin and exposing predictable tool/command names. Build the smallest working plugin before Composio complexity.  
**Delivers:** TypeScript/ESM package, Bun scripts, `tsup` build, `publint`, plugin export, local fixture, command injection skeleton, one `composio_debug_info` stub, static tool/command name tests.  
**Addresses:** npm-installable plugin, local development plugin support, structured schemas, debug foundation.  
**Avoids:** broken npm install, opencode config mistakes, name collisions, network calls during initialization.

### Phase 2: Auth, Signup/Claim, Redacted Debug, and Safety Foundation
**Rationale:** All Composio-backed calls depend on deterministic credentials, and safety/redaction must be designed before exposing mutation-capable tools.  
**Delivers:** Credential resolver, anonymous credential parser/writer, `composio_signup`, `composio_claim`, `/composio-claim` command template, auth state machine, redacted debug output, safety policy framework.  
**Uses:** `@composio/core`, signup/claim HTTP APIs, Zod schemas, filesystem writes with restrictive permissions.  
**Avoids:** credential leaks, duplicate anonymous identities, confusing env-key vs anonymous-file precedence, unsafe claim behavior.

### Phase 3: Composio Meta-Tool Router and Six Meta Tools
**Rationale:** The core product value is Composio’s full meta-tool surface inside opencode; implement shared session/client/error handling once, then layer individual wrappers.  
**Delivers:** Composio HTTP client, per-session tool-router cache, `executeMetaTool`, `composio_search_tools`, `composio_get_tool_schemas`, `composio_manage_connections`, `composio_multi_execute_tool`, `composio_remote_bash_tool`, and `composio_remote_workbench`.  
**Implements:** Schema-first tool discovery/execution flow and risk-classified output normalization.  
**Avoids:** schema drift, unbounded output, destructive remote execution without warnings, CLI dependency.

### Phase 4: Trigger Discovery and Lifecycle APIs
**Rationale:** Trigger authoring is independently complex and mutation-heavy; it should reuse the auth, client, schema, error, and safety primitives from earlier phases.  
**Delivers:** Trigger type list/schema tools, trigger upsert, list active triggers, enable, disable, delete, pagination/filtering, confirmation guard for deletion, duplicate/leak diagnostics.  
**Addresses:** event-driven automation authoring and trigger lifecycle management.  
**Avoids:** disable/delete confusion, duplicate subscriptions, stale schema configs, trigger ID loss.

### Phase 5: Pi-Compatible Automation Handoff
**Rationale:** Handoff writes are local but contract-sensitive; build after trigger result shapes are known so records can store the right IDs/slugs/config metadata.  
**Delivers:** `save_automation_definition`, path precedence (`filePath` → env → default), parent directory creation, atomic writes, malformed-file handling, preservation/upsert of existing records, compatibility fixtures.  
**Addresses:** Pi-compatible automation handoff by default and idempotent local automation records.  
**Avoids:** broken Pi compatibility, lost automations, accidental writes to unexpected locations, duplicate handoff entries.

### Phase 6: Release Hardening, Docs, Permissions, and Smoke/Integration Tests
**Rationale:** The publishable package is not credible until a fresh opencode install can load it, docs snippets validate, and real Composio calls are tested safely.  
**Delivers:** README recipes, canonical tool mapping table, permission snippets, npm pack inspection, tarball install smoke test, mocked unit coverage, opt-in live integration tests, release workflow with provenance/trusted publishing if available.  
**Addresses:** release readiness, supportability, installation confidence, safety documentation.  
**Avoids:** secret publication, invalid opencode config snippets, over-mocked tests, docs that imply the plugin receives webhooks.

### Phase Ordering Rationale

- Registration/package shape comes first because every later feature is invisible if opencode cannot load the plugin or tool names collide.
- Auth, redaction, and safety precede remote wrappers because Composio tools can mutate external systems and tool outputs enter model context/logs.
- Read-only discovery/meta tooling should land before high-risk execution/remote tools and before trigger mutation.
- Trigger lifecycle should precede handoff finalization because handoff records need validated trigger IDs, slugs, schema/version metadata, and idempotency keys.
- Release hardening comes last but should add checks to earlier artifacts: package contents, docs snippets, safety permissions, and live API contracts.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** Signup/claim exact POST payloads and identity state transitions need validation against live APIs or `composio-x-pi` source.
- **Phase 3:** Resolved in implementation with tool-router session handling, meta-tool mapping, and redacted error tests; live API smoke remains in Phase 7.
- **Phase 4:** Resolved in implementation with v3.1 trigger endpoint mapping, filters, upsert, list, enable, disable, delete, and redacted error tests; live trigger smoke remains in Phase 7.
- **Phase 5:** Resolved 2026-05-20 by inspecting `composio-x-pi@0.0.8` README/source/tests for the `save_automation_definition` handoff schema.
- **Phase 6:** Custom-tool permission targeting should be smoke-tested in real opencode to confirm prompts match docs.

Phases with standard patterns (skip research-phase unless requirements change):
- **Phase 1:** opencode plugin packaging, ESM TypeScript package setup, Bun tests, and npm pack validation are well-documented.
- **Phase 2 safety/redaction framework:** general credential precedence/redaction/file permission patterns are established; only endpoint payloads need research.
- **Phase 6 documentation/release gates:** npm `files`, `exports`, `publint`, `npm pack`, and GitHub Actions publishing patterns are standard.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH for opencode/Bun/npm; MEDIUM for Composio meta-tool details | opencode plugin/custom-tool/config docs and npm package versions are current and official; Composio meta tools are documented as session-level tools but wrapper mechanics need live validation. |
| Features | MEDIUM-HIGH | Table stakes are strongly grounded in project scope plus opencode/Composio docs; `composio-x-pi` parity specifics are project-locked but not fully source-inspected. |
| Architecture | MEDIUM-HIGH | opencode plugin architecture and v3.1 endpoint existence are well supported; signup/claim payloads and some command-packaging nuances need implementation-time verification. |
| Pitfalls | MEDIUM-HIGH | Security, packaging, permissions, and trigger lifecycle pitfalls are well documented; exact Composio response/automation schema risks remain partially inferred. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Signup/claim API contract:** Verify exact request/response payloads, idempotency, and claim state transitions before finalizing Phase 2.
- **`composio-x-pi` handoff schema:** Resolved 2026-05-20; `save_automation_definition` now matches the inspected Pi-compatible schema and path precedence.
- **Composio meta-tool execution contract:** Implemented with session creation/cache, `execute_meta` payload mapping, response normalization, and redacted error categories; live verification remains a Phase 7 smoke task.
- **Trigger lifecycle details:** Implemented filters, pagination, upsert response normalization, enable/disable/delete paths, and version metadata handling; live verification remains a Phase 7 smoke task.
- **opencode custom-tool permissions:** Run real smoke tests to confirm custom plugin tool names can be targeted exactly by `permission` config.
- **Output sizing and redaction:** Empirically inspect large Composio responses and add truncation/pagination/includeRaw policies where needed.

## Sources

### Primary (HIGH confidence)
- opencode Plugins docs — npm/local plugin loading, plugin hooks, custom tool registration, Bun install behavior: https://opencode.ai/docs/plugins/
- opencode Custom Tools docs — `tool()` helper, Zod args, context, naming/collision behavior: https://opencode.ai/docs/custom-tools/
- opencode Commands docs — command config/templates and `$ARGUMENTS`: https://opencode.ai/docs/commands/
- opencode Config schema/docs — plugin tuple config, command shape, permissions, config validation: https://opencode.ai/config.json and https://opencode.ai/docs/config/
- opencode Permissions docs — default permissive behavior and named tool permissions: https://opencode.ai/docs/permissions/
- npm package/publishing docs — `files`, `exports`, dependency classification, `npm pack`, public publishing/provenance.
- Bun docs — runtime, test runner, package manager, build behavior.
- Composio TypeScript triggers SDK/reference and trigger docs — trigger lifecycle patterns and schema-first guidance.
- Composio agent signup docs — anonymous credential file and signup/claim flow at a requirements level.
- Project planning context — required v1 scope, Pi-compatible defaults, and non-goals.

### Secondary (MEDIUM confidence)
- Composio meta tools reference — six meta/runtime tools and session-level semantics; wrapper details need validation.
- Composio OpenAPI v3.1 — endpoint existence for tool-router sessions and trigger lifecycle.
- Local Composio skill docs — tool versioning, trigger creation/manage, webhook responsibilities, connected-account errors.

### Tertiary (LOW confidence)
- `composio-x-pi` parity beyond summarized project context — exact handoff schema and signup/claim behavior need source/fixture verification.
- Live behavior of `https://agents.composio.dev/api/signup` and `/claim` — endpoint existence is known, exact POST contract requires validation.

---
*Research completed: 2026-05-15*  
*Ready for roadmap: yes*
