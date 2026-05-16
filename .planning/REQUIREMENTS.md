# Requirements: composio-x-opencode

**Defined:** 2026-05-15  
**Core Value:** An opencode agent can use Composio’s full meta-tool and trigger-authoring surface with no manual setup, including first-use signup, tool execution, trigger creation, and automation handoff.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Packaging & Installation

- [ ] **PKG-01**: User can install `composio-x-opencode` as an opencode plugin from npm.
- [ ] **PKG-02**: Developer can run the extension from a local checkout for development and smoke testing.
- [ ] **PKG-03**: Package exposes a valid opencode plugin entrypoint compatible with `@opencode-ai/plugin`.
- [ ] **PKG-04**: Package includes scripts for test, typecheck, build, integration test, and local smoke test.
- [ ] **PKG-05**: Package can be validated before publish with typecheck, build, test, and npm pack inspection.

### Runtime Registration

- [ ] **RUNT-01**: opencode loads the extension and registers all Composio tools without requiring network calls during plugin initialization.
- [ ] **RUNT-02**: User can run `composio_debug_info` to see extension version, auth source, handoff path, and registered tool names with secrets redacted.
- [ ] **RUNT-03**: Extension tool names are stable, lowercase, prefixed with `composio_`, and documented.
- [ ] **RUNT-04**: Extension tool descriptions clearly mark destructive/open-world tools.

### Authentication & Signup

- [ ] **AUTH-01**: Extension resolves credentials from `COMPOSIO_API_KEY` when present.
- [ ] **AUTH-02**: Extension falls back to `~/.composio/anonymous_user_data.json` when `COMPOSIO_API_KEY` is absent.
- [ ] **AUTH-03**: User can call `composio_signup` to provision a Composio identity with no prior setup.
- [ ] **AUTH-04**: `composio_signup` writes returned anonymous credentials to `~/.composio/anonymous_user_data.json` with restrictive file permissions where supported.
- [ ] **AUTH-05**: Missing-credential failures guide the agent to call `composio_signup`.
- [ ] **AUTH-06**: User can call `composio_claim` with an email to request handoff of the auto-provisioned Composio org.
- [ ] **AUTH-07**: User can run `/composio-claim <email>` as a human-facing opencode command path.
- [ ] **AUTH-08**: Debug output, errors, tests, and logs never expose raw API keys or anonymous credential secrets.

### Composio Meta Tools

- [ ] **META-01**: Agent can call `composio_search_tools` to discover Composio tools by use case.
- [ ] **META-02**: Agent can call `composio_get_tool_schemas` to inspect required inputs before execution.
- [ ] **META-03**: Agent can call `composio_manage_connections` to inspect or initiate required connection/auth flows.
- [ ] **META-04**: Agent can call `composio_multi_execute_tool` to execute one or more Composio tools through the meta-tool runtime.
- [ ] **META-05**: Agent can call `composio_remote_bash_tool` to execute Composio remote bash functionality.
- [ ] **META-06**: Agent can call `composio_remote_workbench` to use Composio remote workbench functionality.
- [ ] **META-07**: Meta-tool wrappers return structured success/error responses suitable for opencode agents.
- [ ] **META-08**: Meta-tool wrappers normalize Composio errors and preserve useful request/error metadata without leaking secrets.

### Trigger Authoring & Lifecycle

- [ ] **TRIG-01**: Agent can call `composio_list_trigger_types` to discover available trigger types.
- [ ] **TRIG-02**: Agent can call `composio_get_trigger_type_schema` to inspect trigger configuration schema before creating a trigger.
- [ ] **TRIG-03**: Agent can call `composio_create_trigger` to create or update a trigger via Composio trigger upsert.
- [ ] **TRIG-04**: Agent can call `composio_list_triggers` to inspect existing trigger instances.
- [ ] **TRIG-05**: Agent can call native opencode tools `composio_enable_trigger` and `composio_disable_trigger` to enable or disable a trigger instance via the Composio trigger management status path.
- [ ] **TRIG-06**: Agent can call `composio_delete_trigger` to permanently delete a trigger instance by exact trigger ID.
- [ ] **TRIG-07**: Trigger delete requires explicit trigger ID and clear destructive intent in the tool schema/description.
- [ ] **TRIG-08**: Trigger tools surface connected-account requirements clearly.

### Automation Handoff

- [ ] **AUTO-01**: Agent can call `save_automation_definition` to persist automation metadata for a host application.
- [ ] **AUTO-02**: By default, automation definitions are written to `~/.config/pi/composio-automations.json`.
- [ ] **AUTO-03**: `PI_COMPOSIO_AUTOMATIONS_JSON` overrides the default handoff path.
- [ ] **AUTO-04**: Per-call `filePath` overrides both the env var and default handoff path.
- [ ] **AUTO-05**: Automation handoff file stores a JSON array and upserts records by `triggerId`.
- [ ] **AUTO-06**: Handoff writes preserve existing unrelated records and unknown fields.
- [ ] **AUTO-07**: Handoff writes are atomic enough to avoid corrupting the JSON file on failed writes.

### Documentation & Verification

- [ ] **DOCS-01**: README documents npm install, local development install, opencode config, command usage, and smoke test workflow.
- [ ] **DOCS-02**: README documents credential precedence and first-use signup behavior.
- [ ] **DOCS-03**: README documents all registered tools and which ones are destructive/open-world.
- [ ] **DOCS-04**: README includes recommended opencode permission snippets for risky Composio tools.
- [ ] **DOCS-05**: README documents integration test environment variables and manual trigger cleanup.
- [ ] **TEST-01**: Unit tests cover credential resolution, redaction, handoff path resolution, handoff upsert, and API error normalization.
- [ ] **TEST-02**: Typecheck and build pass from a clean checkout.
- [ ] **TEST-03**: Integration tests can run with real Composio credentials and trigger fixtures.
- [ ] **TEST-04**: Manual opencode smoke test verifies extension load, debug info, signup, trigger tools, handoff save, and cleanup.

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Generated Tool Surface

- **GEN-01**: User can optionally generate one opencode tool per selected Composio app/tool when a static app-specific tool surface is desired.

### Hosted Automation Runtime

- **HOST-01**: User can run a hosted webhook receiver or automation runner that consumes saved automation definitions.

### User Interface

- **UI-01**: User can manage Composio automations through a UI/dashboard.

### Permission Automation

- **PERM-01**: User can opt into automatic mutation of opencode permission config for Composio tools.

### Version Management

- **VER-01**: User can configure advanced trigger/toolkit version pinning through dedicated UI/config beyond raw supported API inputs.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Per-app tool generation | Meta tools are the intended v1 surface and avoid thousands of opencode tools. |
| Replacing Composio auth/execution/sandboxing | Extension should delegate to Composio infrastructure. |
| Host webhook receiver | Belongs to the host application, not the opencode extension. |
| New automation file format | Must preserve Pi-compatible handoff path and semantics. |
| UI/dashboard | v1 is a tool/command/plugin package. |
| Automatic permission config mutation | v1 should document recommended snippets rather than surprising users by changing config. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PKG-01 | Phase 8 | Pending |
| PKG-02 | Phase 1 | Pending |
| PKG-03 | Phase 1 | Pending |
| PKG-04 | Phase 1 | Pending |
| PKG-05 | Phase 8 | Pending |
| RUNT-01 | Phase 1 | Pending |
| RUNT-02 | Phase 2 | Pending |
| RUNT-03 | Phase 1 | Pending |
| RUNT-04 | Phase 3 | Pending |
| AUTH-01 | Phase 2 | Pending |
| AUTH-02 | Phase 2 | Pending |
| AUTH-03 | Phase 2 | Pending |
| AUTH-04 | Phase 2 | Pending |
| AUTH-05 | Phase 2 | Pending |
| AUTH-06 | Phase 2 | Pending |
| AUTH-07 | Phase 2 | Pending |
| AUTH-08 | Phase 2 | Pending |
| META-01 | Phase 3 | Pending |
| META-02 | Phase 3 | Pending |
| META-03 | Phase 3 | Pending |
| META-04 | Phase 3 | Pending |
| META-05 | Phase 3 | Pending |
| META-06 | Phase 3 | Pending |
| META-07 | Phase 3 | Pending |
| META-08 | Phase 3 | Pending |
| TRIG-01 | Phase 4 | Pending |
| TRIG-02 | Phase 4 | Pending |
| TRIG-03 | Phase 4 | Pending |
| TRIG-04 | Phase 4 | Pending |
| TRIG-05 | Phase 4 | Pending |
| TRIG-06 | Phase 4 | Pending |
| TRIG-07 | Phase 4 | Pending |
| TRIG-08 | Phase 4 | Pending |
| AUTO-01 | Phase 5 | Pending |
| AUTO-02 | Phase 5 | Pending |
| AUTO-03 | Phase 5 | Pending |
| AUTO-04 | Phase 5 | Pending |
| AUTO-05 | Phase 5 | Pending |
| AUTO-06 | Phase 5 | Pending |
| AUTO-07 | Phase 5 | Pending |
| DOCS-01 | Phase 6 | Pending |
| DOCS-02 | Phase 6 | Pending |
| DOCS-03 | Phase 6 | Pending |
| DOCS-04 | Phase 6 | Pending |
| DOCS-05 | Phase 6 | Pending |
| TEST-01 | Phase 7 | Pending |
| TEST-02 | Phase 7 | Pending |
| TEST-03 | Phase 7 | Pending |
| TEST-04 | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 49 total
- Mapped to phases: 49
- Unmapped: 0 ✓
- Duplicate mappings: 0 ✓

---
*Requirements defined: 2026-05-15*  
*Last updated: 2026-05-15 after roadmap revision for native trigger tool registration*
