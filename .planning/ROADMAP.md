# Roadmap: composio-x-opencode

## Overview

This v1 roadmap delivers `composio-x-opencode` as a publishable opencode plugin package that preserves the useful `composio-x-pi` runtime semantics while adapting them to opencode tools, commands, permissions, and npm distribution. Trigger lifecycle capabilities are first-class native opencode tools registered by the plugin, not indirect operations hidden behind a generic wrapper. The phases follow the dependency chain from loadable plugin foundation, to credentials and safe diagnostics, to Composio meta tools, native trigger lifecycle tools, Pi-compatible handoff, documentation, verification, and final npm install readiness.

**Depth:** Comprehensive  
**Mode:** Interactive / sequential  
**Research and plan-check:** Enabled for downstream phase planning

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Package Skeleton & opencode Registration** - Users/developers can load a stable local plugin with predictable tool names and no startup network calls.
- [x] **Phase 2: Credentials, Signup, Claim & Redacted Debug** - Users can provision, resolve, claim, and inspect Composio auth state without leaking secrets.
- [x] **Phase 3: Composio Meta Tools & Safety Descriptions** - Agents can discover, inspect, authenticate, execute, and use Composio remote capabilities through the six meta tools.
- [x] **Phase 4: Native Trigger Authoring & Lifecycle Tools** - Agents can use dedicated native opencode tools to discover trigger schemas and safely create/upsert, list, enable, disable, and delete trigger instances.
- [x] **Phase 5: Pi-Compatible Automation Handoff** - Agents can persist automation definitions to the Pi-compatible JSON handoff contract with path overrides.
- [x] **Phase 6: User Documentation & Permission Guidance** - Users can install, configure, operate, and secure the plugin from README instructions.
- [x] **Phase 7: Automated Verification & Smoke Tests** - Developers can verify behavior with unit, typecheck/build, integration, and manual opencode smoke tests.
- [x] **Phase 8: npm Package Release Readiness** - Users can install the package from npm after pack/publish validation proves the tarball is safe and loadable.

## Phase Details

### Phase 1: Package Skeleton & opencode Registration
**Goal**: Users/developers can load a local `composio-x-opencode` plugin in opencode and see the stable v1 tool namespace registered without any Composio network dependency at startup.  
**Depends on**: Nothing (first phase)  
**Requirements**: PKG-02, PKG-03, PKG-04, RUNT-01, RUNT-03  
**Success Criteria** (what must be TRUE):
  1. Developer can run the extension from a local checkout and opencode loads the plugin entrypoint successfully.
  2. opencode startup registers the fixed v1 `composio_` / `save_automation_definition` tool names without making Composio network calls.
  3. Registered tool names are stable, lowercase, prefixed/namespaced as documented, and avoid opencode built-in collisions.
  4. Developer can run package scripts for test, typecheck, build, integration test, and local smoke test from the checkout.
**Research notes**: Standard opencode plugin packaging and Bun/ESM setup; no extra research phase expected unless plugin API types differ during implementation.  
**Plans:** 3 plans

Plans:
- [x] 01-package-skeleton-opencode-registration-01-PLAN.md — Create the Bun/TypeScript ESM package skeleton, required scripts, build config, and version helper.
- [x] 01-package-skeleton-opencode-registration-02-PLAN.md — Register and document the fixed v1 opencode tool namespace from a static, network-free plugin manifest.
- [x] 01-package-skeleton-opencode-registration-03-PLAN.md — Add naming/no-network tests, local build-load integration, opencode config example, and smoke script.

### Phase 2: Credentials, Signup, Claim & Redacted Debug
**Goal**: Users can use Composio with no manual setup, claim an anonymous Composio identity through tool or slash-command paths, and inspect runtime/auth state without exposing secrets.  
**Depends on**: Phase 1  
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08, RUNT-02  
**Success Criteria** (what must be TRUE):
  1. User can resolve auth from `COMPOSIO_API_KEY` when present, with debug output clearly indicating env-key precedence without showing the key.
  2. User can fall back to `~/.composio/anonymous_user_data.json` when no env key is present.
  3. User can call `composio_signup` with no prior setup and receive persisted anonymous credentials with restrictive file permissions where supported.
  4. User can request org handoff using either `composio_claim` or `/composio-claim <email>` and receive actionable status/next steps.
  5. User can run `composio_debug_info` and see version, auth source, handoff path, and registered tools with all secrets redacted.
**Research flags**: Signup/claim exact POST payloads, response shapes, idempotency, and identity state transitions need validation against live APIs or `composio-x-pi` source before final implementation planning.  
**Plans:** 4 plans

Plans:
- [x] 02-credentials-signup-claim-redacted-debug-01-PLAN.md — Create shared anonymous credential persistence, env-first auth resolution, signup guidance, and redaction primitives.
- [x] 02-credentials-signup-claim-redacted-debug-02-PLAN.md — Implement official Composio anonymous signup/whoami flow, safe signup tool output, and opt-in live API contract test.
- [x] 02-credentials-signup-claim-redacted-debug-03-PLAN.md — Implement anonymous org claim/handoff plus a verifyable `/composio-claim <email>` command path/template.
- [x] 02-credentials-signup-claim-redacted-debug-04-PLAN.md — Wire real Phase 2 handlers into the plugin registry and replace placeholder diagnostics with redacted debug info.

### Phase 3: Composio Meta Tools & Safety Descriptions
**Goal**: Agents can use Composio’s complete v1 meta-tool surface inside opencode for discovery, schema lookup, connection management, multi-tool execution, remote bash, and remote workbench, with structured safe outputs.  
**Depends on**: Phase 2  
**Requirements**: META-01, META-02, META-03, META-04, META-05, META-06, META-07, META-08, RUNT-04  
**Success Criteria** (what must be TRUE):
  1. Agent can discover available Composio tools with `composio_search_tools` and inspect required inputs with `composio_get_tool_schemas` before execution.
  2. Agent can inspect/initiate connection flows through `composio_manage_connections` when a tool or trigger requires an account connection.
  3. Agent can execute Composio tools via `composio_multi_execute_tool` and receive per-action structured success/error results.
  4. Agent can use `composio_remote_bash_tool` and `composio_remote_workbench` as explicitly marked remote/open-world capabilities, not local shell operations.
  5. Meta-tool errors preserve useful request/error metadata while redacting credentials and warning on destructive/open-world tools.
**Research flags**: Resolved in implementation with shared Composio client, tool-router session handling, normalized redacted errors, and meta-tool mapping tests; live API smoke remains part of Phase 7.  
**Plans**: Completed directly in implementation session with unit, typecheck, build, and local-load verification.

### Phase 4: Native Trigger Authoring & Lifecycle Tools
**Goal**: Agents can author and manage Composio trigger instances end-to-end through dedicated native opencode tools registered by the plugin while avoiding guessed schemas, duplicate triggers, and accidental destructive deletion.  
**Depends on**: Phase 3  
**Requirements**: TRIG-01, TRIG-02, TRIG-03, TRIG-04, TRIG-05, TRIG-06, TRIG-07, TRIG-08  
**Success Criteria** (what must be TRUE):
  1. Agent can discover trigger types with native opencode tool `composio_list_trigger_types` and inspect a selected trigger schema with native opencode tool `composio_get_trigger_type_schema` before creation.
  2. Agent can create or upsert a trigger through native opencode tool `composio_create_trigger` and receive the trigger ID, slug, status, and connected-account requirements needed for follow-up work.
  3. Agent can list existing trigger instances through native opencode tool `composio_list_triggers` and identify status, IDs, slugs, and connection requirements before mutating them.
  4. Agent can enable or disable an exact trigger instance through native opencode tools `composio_enable_trigger` and `composio_disable_trigger` without confusing temporary pause with permanent deletion.
  5. Agent can permanently delete a trigger through native opencode tool `composio_delete_trigger` only by exact trigger ID with clear destructive intent in the tool schema/description.
**Research flags**: Resolved in implementation with native opencode tool wrappers, v3.1 trigger endpoint mapping, pagination/filter support, upsert response normalization, enable/disable/delete management paths, and redacted error handling; live API smoke remains part of Phase 7.  
**Plans**: Completed directly in implementation session with unit, typecheck, build, and local-load verification.

### Phase 5: Pi-Compatible Automation Handoff
**Goal**: Agents can write host automation metadata to the existing Pi-compatible JSON handoff file safely and idempotently after trigger authoring.  
**Depends on**: Phase 4  
**Requirements**: AUTO-01, AUTO-02, AUTO-03, AUTO-04, AUTO-05, AUTO-06, AUTO-07  
**Success Criteria** (what must be TRUE):
  1. Agent can call `save_automation_definition` and see exactly where the automation record was written.
  2. Handoff path resolves predictably as per-call `filePath` first, then `PI_COMPOSIO_AUTOMATIONS_JSON`, then `~/.config/pi/composio-automations.json`.
  3. Handoff file remains a JSON array and rerunning the same automation updates the record by `triggerId` rather than creating duplicates.
  4. Existing unrelated records and unknown fields survive a handoff write.
  5. Failed writes do not corrupt the existing handoff file.
**Research flags**: Resolved 2026-05-20 by inspecting `composio-x-pi@0.0.8` README/source/tests for `save_automation_definition`.  
**Plans**: Completed directly in implementation session with unit, typecheck, build, and local-load verification.

### Phase 6: User Documentation & Permission Guidance
**Goal**: Users can install, configure, operate, smoke-test, and secure the plugin from README instructions without scope confusion or unsafe defaults.  
**Depends on**: Phase 5  
**Requirements**: DOCS-01, DOCS-02, DOCS-03, DOCS-04, DOCS-05  
**Success Criteria** (what must be TRUE):
  1. User can follow README instructions for npm install, local development install, opencode config, command usage, and smoke-test workflow.
  2. User can understand credential precedence, first-use signup, and claim behavior without reading source code.
  3. User can see a canonical table of all registered tools and which are destructive/open-world.
  4. User can copy recommended opencode permission snippets for risky Composio tools without the plugin mutating their config automatically.
  5. User can run integration tests safely by following documented environment variables and manual trigger cleanup steps.
**Research notes**: Standard documentation/release guidance; ensure examples validate against current opencode config schema.  
**Plans**: Completed directly in implementation session with README rewrite, permission snippets, smoke/integration instructions, out-of-scope boundaries, and Phase 6 summary.

### Phase 7: Automated Verification & Smoke Tests
**Goal**: Developers can prove the plugin works from a clean checkout and against safe real Composio fixtures before release.  
**Depends on**: Phase 6  
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04  
**Success Criteria** (what must be TRUE):
  1. Developer can run unit tests covering credential resolution, redaction, handoff path resolution/upsert, and API error normalization.
  2. Developer can run typecheck and build from a clean checkout and get passing results.
  3. Developer can opt into integration tests with real Composio credentials and trigger fixtures without running destructive remote bash/workbench by default.
  4. Developer can complete the manual opencode smoke test and verify extension load, debug info, signup, trigger tools, handoff save, and cleanup.
**Research flags**: opencode custom-tool permission targeting should be smoke-tested in real opencode to confirm prompts/snippets match actual custom tool names.  
**Plans**: Implemented in one verification pass; see `.planning/phases/07-automated-verification-smoke-tests/07-automated-verification-smoke-tests-SUMMARY.md`.

### Phase 8: npm Package Release Readiness
**Goal**: Users can install `composio-x-opencode` from npm with confidence that the package contents, exports, and opencode load path have been validated.  
**Depends on**: Phase 7  
**Requirements**: PKG-01, PKG-05  
**Success Criteria** (what must be TRUE):
  1. User can install `composio-x-opencode` as an opencode plugin from npm and opencode loads it successfully.
  2. Developer can validate the package before publish with typecheck, build, tests, and npm pack inspection.
  3. Packed npm tarball includes the plugin entrypoint, built artifacts, README, and license while excluding secrets, planning files, local credential files, and unsafe fixtures.
  4. Fresh npm-style install smoke test confirms the package registers the same tool names as local development.
**Research notes**: Standard npm packaging checks, but keep pack inspection strict because credential and planning-file leaks are critical pitfalls.  
**Plans**: Completed directly in one local release-readiness pass with MIT licensing, package metadata, `release:check`, strict tarball audit, fresh tarball install smoke, README release guidance, and pack/load verification.

## Research Flags by Phase

| Phase | Research needed during planning |
|-------|---------------------------------|
| 2 | Signup/claim exact POST payloads, response shapes, idempotency, and identity state transitions. |
| 3 | Resolved in implementation; live Composio smoke coverage added in Phase 7. |
| 4 | Resolved in implementation; live trigger fixture smoke coverage added in Phase 7. |
| 5 | Resolved 2026-05-20: inspected `composio-x-pi@0.0.8` handoff schema/fields and tests. |
| 7 | opencode custom-tool permission targeting smoke test to confirm prompts and README snippets match real behavior. |

## Coverage

Every v1 requirement maps to exactly one phase.

| Requirement Group | Count | Phase |
|-------------------|-------|-------|
| Packaging & Installation | 5 | Phases 1, 8 |
| Runtime Registration | 4 | Phases 1, 2, 3 |
| Authentication & Signup | 8 | Phase 2 |
| Composio Meta Tools | 8 | Phase 3 |
| Trigger Authoring & Lifecycle | 8 | Phase 4 |
| Automation Handoff | 7 | Phase 5 |
| Documentation | 5 | Phase 6 |
| Verification Tests | 4 | Phase 7 |
| **Total** | **49** | **49 mapped** |

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Package Skeleton & opencode Registration | 3/3 | Complete | 2026-05-16 |
| 2. Credentials, Signup, Claim & Redacted Debug | 4/4 | Complete | 2026-05-16 |
| 3. Composio Meta Tools & Safety Descriptions | 1/1 | Complete | 2026-05-20 |
| 4. Native Trigger Authoring & Lifecycle Tools | 1/1 | Complete | 2026-05-20 |
| 5. Pi-Compatible Automation Handoff | 1/1 | Complete | 2026-05-20 |
| 6. User Documentation & Permission Guidance | 1/1 | Complete | 2026-05-20 |
| 7. Automated Verification & Smoke Tests | 1/1 | Complete | 2026-05-20 |
| 8. npm Package Release Readiness | 1/1 | Complete | 2026-05-20 |
