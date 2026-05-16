# Feature Landscape

**Domain:** opencode extension wrapping Composio meta tools, trigger authoring APIs, signup/claim, and Pi-compatible automation handoff  
**Project:** composio-x-opencode  
**Researched:** 2026-05-15  
**Overall confidence:** MEDIUM-HIGH — opencode plugin/custom-tool/command behavior is verified from official docs; Composio trigger and MCP/session patterns are verified from official/packaged docs; `composio-x-pi` parity is user-locked project context rather than independently inspected source.

## Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| npm-installable opencode plugin package | opencode officially supports npm plugins through the `plugin` config and auto-installs them with Bun at startup. A published package is the primary distribution path for v1 users. | Med | Must export a plugin function compatible with `@opencode-ai/plugin`. Include package metadata, ESM output, and a documented `opencode.json` snippet. HIGH confidence. |
| Local development plugin support | opencode supports project/global plugin directories (`.opencode/plugins/`, `~/.config/opencode/plugins/`). A greenfield extension needs a local checkout smoke path before npm release. | Low | Provide a local plugin shim or docs that load built artifacts from checkout. HIGH confidence. |
| Register all six Composio meta/runtime tools | User-locked v1 scope requires `COMPOSIO_SEARCH_TOOLS`, `COMPOSIO_GET_TOOL_SCHEMAS`, `COMPOSIO_MANAGE_CONNECTIONS`, `COMPOSIO_MULTI_EXECUTE_TOOL`, `COMPOSIO_REMOTE_BASH_TOOL`, and `COMPOSIO_REMOTE_WORKBENCH`. Without these, opencode cannot discover, authenticate, execute, or use remote sandbox/workbench capabilities. | High | Implement as opencode plugin custom tools, not per-app generated tools. Descriptions must clearly mark open-world/destructive tools. MEDIUM-HIGH confidence from project context + Composio docs. |
| Schema-first tool discovery flow | Composio guidance says not to guess tool or trigger slugs; agents should search/list first, inspect schemas, then execute. | Med | `COMPOSIO_SEARCH_TOOLS` and `COMPOSIO_GET_TOOL_SCHEMAS` must be ergonomic, strongly validated, and documented as the first step. HIGH confidence. |
| Connection management/auth flow | Composio tools frequently require connected accounts; missing connection handling should guide the agent/user to authenticate instead of failing opaquely. | High | `COMPOSIO_MANAGE_CONNECTIONS` is table stakes because trigger creation and many tool executions require a connected account. HIGH confidence. |
| Multi-tool execution wrapper | Composio meta tools include `COMPOSIO_MULTI_EXECUTE_TOOL`; parity requires batching/parallel-ish execution where Composio supports it. | Med | Return per-tool structured results and partial failures so opencode can recover. MEDIUM confidence. |
| Remote bash tool wrapper | User explicitly locked remote bash into v1 despite open-world risk. Product is incomplete if parity omits it. | Med | Must include scary descriptions and recommend opencode permission rules. Do not silently execute local shell; this delegates to Composio remote infrastructure. MEDIUM-HIGH confidence. |
| Remote workbench wrapper | User explicitly locked remote workbench into v1. It complements remote bash for sandbox/workbench workflows. | Med | Treat as privileged. Avoid broad local filesystem side effects. MEDIUM-HIGH confidence. |
| Trigger type listing | Agents need to discover trigger slugs before authoring; Composio trigger docs explicitly warn not to guess trigger names. | Med | Include filters such as toolkit/search if the backing API supports them. HIGH confidence. |
| Trigger type schema lookup | Creating triggers requires a trigger-specific config schema; schema lookup prevents hallucinated trigger configs. | Med | Required before create/upsert in agent instructions. HIGH confidence. |
| Trigger create/upsert | Core value includes event-driven automation authoring. Project context locks `POST /api/v3.1/trigger_instances/{slug}/upsert`. | High | Inputs should include trigger slug, user/account identifiers/config, trigger config, and optional automation handoff metadata. HIGH confidence from project context. |
| List trigger instances | Users must inspect what automations/triggers exist before managing them. | Med | Include filters by slug/status/account where available. HIGH confidence. |
| Enable/disable trigger instance | Trigger lifecycle APIs in scope include `PATCH /trigger_instances/manage/{triggerId}` with `enable`/`disable`; lifecycle management is incomplete without this. | Med | Should be explicit and permission-worthy because it changes automation behavior. HIGH confidence from project context. |
| Delete trigger instance | Deletion is part of locked v1 lifecycle scope. | Med | Destructive: tool description should say permanent. Prefer require explicit `triggerId` and maybe `confirm: true` argument if compatible with opencode UX. HIGH confidence from project context. |
| First-use `composio_signup` provisioning | Core value says no manual setup. New users must be able to provision credentials via `https://agents.composio.dev/api/signup` behavior like `composio-x-pi`. | High | Should run explicitly as a tool and be callable implicitly by other tools when no API key/anonymous credentials exist. MEDIUM confidence: endpoint behavior is project-locked but not independently documented here. |
| Credential precedence: `COMPOSIO_API_KEY` first, then `~/.composio/anonymous_user_data.json` | Required for CI/power users while preserving Pi-style anonymous onboarding. Missing precedence creates confusing auth behavior. | Med | Debug output must show source without leaking secret. HIGH confidence from project context. |
| Anonymous credential persistence | Signup must persist anonymous user data to `~/.composio/anonymous_user_data.json` to match Pi compatibility and avoid repeated signup. | Med | Ensure file permissions are conservative where possible. MEDIUM confidence from project context. |
| `composio_claim` tool | Agents need a programmatic way to hand off anonymous org/account ownership. User locked this into scope. | Med | Should accept email and return clear next steps/status. MEDIUM confidence from project context. |
| `/composio-claim <email>` opencode command | Humans in the TUI expect slash commands for manual workflows; opencode supports custom commands via config/files. | Med | Because plugins do not appear to define slash commands directly in docs, v1 should ship a command file/config snippet or installer guidance in addition to the tool. HIGH confidence for command model; MEDIUM for packaging command with plugin. |
| `save_automation_definition` handoff tool | Core compatibility path with `composio-x-pi` requires writing automation handoff records. Without this, trigger authoring does not hand off to the host automation runner. | High | Preserve existing file format; do not invent new schema. HIGH confidence from project context. |
| Default handoff path `~/.config/pi/composio-automations.json` | Pi compatibility depends on the default path. | Low | Must create parent directory if absent and append/update safely. HIGH confidence from project context. |
| Handoff path overrides | User locked both `PI_COMPOSIO_AUTOMATIONS_JSON` and per-call `filePath`. Needed for tests, CI, and non-Pi host apps. | Low | Precedence should be per-call `filePath` → env var → default Pi path. HIGH confidence from project context. |
| `composio_debug_info` tool | Required to diagnose auth source, registered tools, runtime, package version, and handoff path. Critical for extension install/support. | Low | Redact secrets; include opencode plugin context if available. HIGH confidence. |
| Structured argument schemas and result shapes | opencode custom tools use Zod schemas through `tool.schema`; agents need validated inputs and parseable outputs. | Med | Prefer stable JSON-like returns over prose for all API wrappers; include error codes/details. HIGH confidence from opencode docs. |
| Safety-oriented tool descriptions and permission docs | opencode defaults are permissive; remote bash/workbench, connection management, multi-execute, enable/disable, delete are risky. | Med | Ship recommended `permission` config snippets (`ask` for Composio destructive tools). HIGH confidence from opencode permissions docs. |
| Tests, typecheck, build, integration hooks, manual opencode smoke test | User-locked release readiness. Without tests, a publishable plugin is not credible. | Med | Integration tests should be opt-in behind real credentials/trigger fixtures; smoke test should verify plugin loading and tool visibility. HIGH confidence. |

## Differentiators

Features that set product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Pi-compatible automation handoff by default | Lets existing Pi/host automation readers consume opencode-authored automations without migration. | Med | This is both table stakes for this project and a differentiator versus a generic Composio plugin. HIGH confidence. |
| Zero-setup onboarding with graceful implicit signup | New opencode users can ask for Composio work immediately; the extension self-provisions anonymous credentials when safe. | High | Prefer explicit `composio_signup` in docs, but wrappers can suggest/run signup when no credentials exist. MEDIUM confidence. |
| Dual human/agent claim flow | `/composio-claim <email>` helps humans; `composio_claim` helps agents complete setup in automation. | Med | This is parity-polish from `composio-x-pi` and fits opencode commands/tools split. MEDIUM-HIGH confidence. |
| Agent workflow recipes embedded in docs/command prompts | Reduces misuse: “search tools → inspect schema → manage connection → execute” and “list trigger types → schema → upsert → save handoff.” | Low | Could be delivered as README recipes and command templates rather than extra runtime code. HIGH confidence. |
| Rich debug report with redaction | Faster support for “why can’t my agent use Composio?” by showing package version, credential source, signup file presence, tool registration names, and handoff destination. | Low | Should never print API keys or full credential blobs. HIGH confidence. |
| Idempotent trigger/handoff helpers | Avoids duplicate automations when agents rerun setup. | Med | Use upsert semantics for triggers; for handoff file, use stable automation IDs or update-by-key if the Pi format supports it. MEDIUM confidence; exact Pi file semantics need validation. |
| Permission snippet generator or docs section | Because opencode permissions are configurable and defaults are permissive, provide copy-paste `ask` rules for destructive Composio tools. | Low | Full automatic permission mutation is an anti-feature; docs/snippet is enough for v1. HIGH confidence. |
| Opt-in integration diagnostics | A command/tool mode that performs non-destructive API reachability checks can distinguish auth, network, and schema issues. | Med | Keep separate from `composio_debug_info` if it calls remote APIs. MEDIUM confidence. |
| Versioned compatibility notes with `composio-x-pi` | Builds trust that opencode-authored automation handoff remains compatible. | Low | Document the source/shape of supported automation records and any known deltas. MEDIUM confidence. |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Generate one opencode tool per Composio app/tool | Would create thousands of tools, increase prompt/tool-selection noise, and duplicate Composio’s own discovery/schema system. It is explicitly out of scope. | Expose the six Composio meta tools and teach agents to search/schema/execute. |
| Replace Composio auth, execution, sandboxing, or trigger infrastructure | Reimplementation would be brittle, high-risk, and outside extension value. | Delegate to Composio APIs/SDK/meta tools; focus on opencode integration and compatibility. |
| Host a webhook receiver inside the extension | opencode plugin is not the host app runtime; Composio webhook docs require public HTTPS, signature verification, quick 200s, and idempotency. | Write Pi-compatible handoff records for the host automation runner; document webhook receiver responsibilities. |
| Invent a new automation file format | Breaks Pi compatibility and forces host migration. | Preserve `~/.config/pi/composio-automations.json`; only add fields if backward-compatible and necessary. |
| Build a UI/dashboard | v1 is an opencode extension package; UI would slow release and duplicate Composio/opencode surfaces. | Use opencode tools, slash command, README recipes, and debug output. |
| Auto-mutate user opencode permission config | Security-sensitive and surprising; opencode supports layered global/project/managed permissions. | Provide recommended snippets and let users/orgs apply them. |
| Hide destructive tool risk for smoother UX | Remote bash/workbench, trigger delete, and connection management can cause real side effects. | Make descriptions explicit and recommend `ask` permissions. |
| Use low-level direct tool execution as the only path when meta tools suffice | Current Composio guidance discourages low-level direct tool execution unless explicitly needed; the product’s value is meta-tool wrapping. | Wrap the locked meta tools; only use direct REST/SDK for signup, claim, trigger lifecycle, and handoff features not covered by meta tools. |
| Require users to run `composio init` before first use | Violates no-manual-setup core value and Pi parity. | Resolve `COMPOSIO_API_KEY`, else anonymous credential file, else `composio_signup`. |
| Store anonymous credentials in an opencode-specific secret file for v1 | Breaks compatibility and creates migration burden. | Reuse `~/.composio/anonymous_user_data.json`. |
| Silently run local shell commands for remote bash/workbench | Confuses local vs Composio remote execution and creates unexpected local side effects. | Clearly delegate to Composio remote tools and label outputs as remote. |

## Feature Dependencies

```text
npm/local plugin packaging → opencode tool registration
opencode tool registration → all Composio meta/runtime tools
opencode tool registration → trigger lifecycle tools
opencode command delivery/docs → /composio-claim <email>

Credential resolver (COMPOSIO_API_KEY → anonymous file) → all Composio API/meta-tool calls
composio_signup → anonymous credential persistence
anonymous credential persistence → credential resolver fallback
credential resolver → composio_claim
credential resolver → COMPOSIO_SEARCH_TOOLS / GET_TOOL_SCHEMAS / MANAGE_CONNECTIONS / MULTI_EXECUTE / REMOTE_BASH / REMOTE_WORKBENCH
credential resolver → trigger type/list/schema/create/manage/delete tools

COMPOSIO_SEARCH_TOOLS → COMPOSIO_GET_TOOL_SCHEMAS → COMPOSIO_MULTI_EXECUTE_TOOL
COMPOSIO_MANAGE_CONNECTIONS → COMPOSIO_MULTI_EXECUTE_TOOL for tools requiring connected accounts
COMPOSIO_MANAGE_CONNECTIONS → trigger create/upsert for connected-account triggers

Trigger type listing → trigger type schema lookup → trigger create/upsert
trigger create/upsert → save_automation_definition
list trigger instances → enable/disable trigger
list trigger instances → delete trigger

save_automation_definition → handoff path resolver
handoff path resolver (filePath → PI_COMPOSIO_AUTOMATIONS_JSON → ~/.config/pi/composio-automations.json) → Pi-compatible automation handoff

tool registration + credential resolver + handoff path resolver → composio_debug_info
destructive/open-world tools → safety descriptions + permission documentation
all runtime features → tests/typecheck/build/integration hooks/manual opencode smoke test
```

## MVP Recommendation

Prioritize:
1. **Plugin packaging and opencode tool registration** — proves the extension loads locally and from npm, the prerequisite for every other feature.
2. **Credential resolver + `composio_signup` + anonymous credential persistence** — delivers the no-manual-setup promise and unlocks all Composio calls.
3. **All six Composio meta/runtime tools** — satisfies parity-critical discovery, auth, execution, and remote capability surface.
4. **Trigger discovery/schema/create/list/manage/delete lifecycle tools** — enables event-driven automation authoring instead of just runtime tool execution.
5. **Pi-compatible `save_automation_definition` with path overrides** — preserves the automation handoff path that makes created triggers useful to host automation runners.
6. **`composio_claim` tool + `/composio-claim <email>` command path** — completes account/org handoff for anonymous users.
7. **`composio_debug_info`, safety docs, tests, and smoke test** — required for supportability and release confidence.

Defer:

- **Per-app opencode tool generation:** explicitly out of scope; meta tools are the right v1 surface.
- **Hosted webhook receiver:** belongs to the consuming host app, not the extension.
- **UI/dashboard:** not needed for v1; opencode tools/commands/docs are enough.
- **Automatic permission config mutation:** provide copy-paste snippets instead.
- **Advanced trigger version pinning UI/config:** useful later, but v1 should first expose schema lookup and create/upsert; add version pinning only if the backed API/SDK path is validated during implementation.

## Sources

- OpenCode Plugins docs (HIGH): https://opencode.ai/docs/plugins/ — verifies plugin distribution from local files and npm packages, plugin context, custom tool registration from plugins, load order, and structured logging. Last updated 2026-05-15.
- OpenCode Custom Tools docs (HIGH): https://opencode.ai/docs/custom-tools/ — verifies custom tool locations, `tool()` helper, Zod schemas, tool naming, context, and collision behavior. Last updated 2026-05-15.
- OpenCode Commands docs (HIGH): https://opencode.ai/docs/commands/ — verifies slash-command files/config, arguments, and command packaging model. Last updated 2026-05-15.
- OpenCode Config docs (HIGH): https://opencode.ai/docs/config/ — verifies config precedence, plugin config, commands config, env/file variables, and `.opencode` directory behavior. Last updated 2026-05-15.
- OpenCode Permissions docs (HIGH): https://opencode.ai/docs/permissions/ — verifies permission actions, defaults, granular patterns, external directory handling, and per-agent overrides. Last updated 2026-05-15.
- Composio skill packaged docs: `building-with-composio.md`, `triggers-create.md`, `triggers-webhook.md` (MEDIUM-HIGH): verifies current Composio SDK/tooling concepts, trigger discovery/schema/create/list/manage patterns, connected-account requirement, warning not to guess trigger names, and webhook receiver responsibilities.
- Composio official MCP docs fetched from https://docs.composio.dev/docs/mcp (MEDIUM): verifies current terminology, session/MCP direction, install packages, user ID/session patterns, and AI-generator guardrails against outdated Composio terms.
- Project context `.planning/PROJECT.md` and user-locked scope (HIGH for requirements, MEDIUM for external parity facts): defines required meta tools, signup/claim behavior, credential precedence, Pi-compatible automation handoff path, trigger lifecycle endpoints, out-of-scope boundaries, and testing expectations.
