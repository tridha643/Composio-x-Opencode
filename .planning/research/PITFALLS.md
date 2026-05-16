# Domain Pitfalls

**Domain:** opencode extension/plugin exposing Composio meta tools, trigger lifecycle APIs, first-use signup, claim, and Pi-compatible automation handoff  
**Project:** composio-x-opencode  
**Researched:** 2026-05-15  
**Overall confidence:** MEDIUM-HIGH. opencode plugin/config/custom-tool behavior is verified against current official opencode docs and schema dated May 15, 2026. Composio trigger/tool/version guidance is from local Composio skill docs and project context, not live Context7, so mark Composio API-shape details MEDIUM unless also present in `.planning/PROJECT.md`.

## Critical Pitfalls

Mistakes that cause security incidents, broken installs, lost automations, trigger leaks, or major rewrites.

### Pitfall 1: Registering destructive Composio tools as ordinary low-risk tools

**What goes wrong:** `COMPOSIO_REMOTE_BASH_TOOL`, `COMPOSIO_REMOTE_WORKBENCH`, `COMPOSIO_MULTI_EXECUTE_TOOL`, connection management, trigger enable/disable, and trigger delete are exposed with generic descriptions and no explicit permission guidance. The model treats them like harmless discovery tools.

**Why it happens:** opencode permissions default permissive for most operations; official docs state most permissions default to `allow`, with only `doom_loop` and `external_directory` defaulting to `ask`, and `.env` reads denied by default. Custom plugin tools become available alongside built-ins, and a custom tool can even take precedence over a built-in tool if named the same.

**Consequences:** Agents can run remote commands, change third-party state, disable automations, or delete trigger instances without a meaningful approval boundary. A bad prompt, prompt injection from tool output, or accidental multi-execute call can create data loss or execute commands against remote environments.

**Prevention:**
- Split tool risk levels in the implementation and documentation: discovery/debug (`search`, `schema`, `debug`) vs auth/state-changing (`manage_connections`, `multi_execute`) vs destructive/open-world (`remote_bash`, `remote_workbench`, `trigger_delete`, `trigger_enable_disable`).
- Give destructive tools names and descriptions that include explicit risk language, e.g. “Runs remote shell commands via Composio; may mutate external systems; require user approval for untrusted requests.”
- Ship a recommended opencode config snippet that sets default approvals for the extension’s high-risk tools. Validate against `https://opencode.ai/config.json` because unknown config keys hard-fail opencode.
- Implement an internal confirmation guard for irreversible lifecycle operations where feasible: require `confirm: true` plus the exact `triggerId` for delete; require tool input schema fields to distinguish `disable` from `delete`.
- Log every state-changing Composio call with tool slug, trigger ID, auth source, and redacted user/account identifiers via opencode structured logging rather than `console.log`.

**Detection / warning signs:**
- README says “all tools are available” but does not classify remote bash/workbench/delete as destructive.
- Tests only assert happy-path execution and do not assert that destructive calls require explicit confirmation input.
- Manual smoke test runs `remote_bash` or trigger deletion without any user-visible warning.
- Tool descriptions omit verbs like “delete”, “disable”, “execute remote command”, or “mutates external state”.

**Phase should address:** Phase 1 (plugin/tool registration) and Phase 2 (Composio wrappers) before any integration testing with real accounts.

**Confidence:** HIGH for opencode permission/default/custom-tool behavior from official docs; MEDIUM for exact Composio meta-tool destructive surface from project context.

### Pitfall 2: Leaking or mishandling credentials during first-use signup, fallback, debug, and publishing

**What goes wrong:** The extension reads/writes `~/.composio/anonymous_user_data.json`, accepts `COMPOSIO_API_KEY`, exposes `composio_debug_info`, and may include local fixture files in the npm tarball. A careless implementation logs tokens, prints raw anonymous credential JSON, checks fixture credentials into git, or publishes local credential files.

**Why it happens:** The project intentionally has two credential sources. opencode supports config variable substitution from env vars and files; npm warns that pretty much everything in a package folder is exposed by default unless `files`/`.npmignore` is managed and tested with `npm pack`.

**Consequences:** API keys or anonymous signup tokens can appear in opencode transcripts, package tarballs, CI logs, debug output, screenshots, or plugin structured logs. A published token cannot be recalled from already-downloaded packages and may let attackers execute Composio tools or claim identity.

**Prevention:**
- Centralize auth loading in one module with strict precedence: `COMPOSIO_API_KEY` first; fallback to `~/.composio/anonymous_user_data.json`; never silently merge both.
- Redact all credential-like values before returning tool output or debug info. `composio_debug_info` should show auth source (`env`, `anonymous_file`, `missing`) and file existence/path, not token contents.
- Create anonymous credential files with owner-only permissions where platform permits (`0600` on POSIX), and never store credentials under project root.
- Add tests that scan tool/debug outputs for the real test key prefix or fixture token values.
- Use `package.json#files` allowlist and run `npm pack --dry-run`/`npm pack` inspection in release checks. Do not rely only on `.gitignore`; npm docs say missing `.npmignore` falls back to `.gitignore`, but `files` is safer for allowlisting.
- Add `.npmignore` or `files` exclusions for `.env*`, fixtures containing “api_key”, local `.composio`, `.opencode` smoke credentials, and generated debug logs.

**Detection / warning signs:**
- `composio_debug_info` includes raw JSON from `anonymous_user_data.json`.
- Tests snapshot entire error objects from Composio SDK/API without redaction.
- `npm pack` includes `.planning`, `.env`, test fixtures, local logs, or source maps containing env-var values.
- Implementation has more than one auth-loading path.

**Phase should address:** Phase 1 (auth module and debug design), Phase 4 (packaging/release), and Phase 5 (integration tests with real credentials).

**Confidence:** HIGH for npm package exposure behavior and opencode config/env-file substitution from official docs; MEDIUM for anonymous credential file semantics from project context.

### Pitfall 3: Breaking Pi-compatible automation handoff by “improving” the file path or format

**What goes wrong:** The opencode port writes a new opencode-specific automation file, changes JSON shape, ignores `PI_COMPOSIO_AUTOMATIONS_JSON`, overwrites existing entries, or treats `filePath` overrides inconsistently.

**Why it happens:** Greenfield ports often normalize paths and schemas to the new host instead of preserving compatibility. The project explicitly requires defaulting to `~/.config/pi/composio-automations.json` and preserving the Pi-compatible handoff path and format.

**Consequences:** Existing Pi/host readers miss automations, users think triggers were created but host automation never runs, and later phases need a migration layer or adapter rewrite. Concurrent writes can lose automations if the extension rewrites the full file without atomic read-modify-write.

**Prevention:**
- Treat the Pi handoff format as a contract. Implement a compatibility fixture copied from composio-x-pi behavior before writing feature code.
- Use path precedence in one function: per-call `filePath` > `PI_COMPOSIO_AUTOMATIONS_JSON` > `~/.config/pi/composio-automations.json`.
- Preserve unknown fields and existing records when updating. Prefer append/upsert by stable automation ID rather than replace-file semantics.
- Write atomically: ensure parent directory exists, write temp file in same directory, fsync if feasible, then rename.
- Add tests for default path, env override, per-call override, malformed existing JSON, missing directory, duplicate upsert, and concurrent-ish sequential writes.

**Detection / warning signs:**
- Code references `~/.config/opencode` for automations instead of `~/.config/pi`.
- There is no fixture representing an existing Pi automation file.
- `save_automation_definition` opens the file with write/truncate before reading existing content.
- Tests only cover an empty automation file.

**Phase should address:** Phase 2 (automation handoff tool) before trigger lifecycle work depends on it.

**Confidence:** HIGH for project requirements; LOW-MEDIUM for exact composio-x-pi file schema because the reference package README/code was not available in this workspace beyond `.planning/PROJECT.md`.

### Pitfall 4: Losing automations by confusing trigger disable with permanent delete

**What goes wrong:** The extension offers `delete_trigger` as a convenient cleanup path, maps “pause”, “turn off”, or “remove from active list” to delete, or tries to implement upsert by deleting/recreating triggers.

**Why it happens:** Trigger lifecycle APIs have similar operations but different semantics. Composio guidance says disable pauses events, enable resumes, update changes config without recreation, and delete is permanent. Project context also identifies `DELETE .../trigger_instances/manage/{triggerId}` as permanent deletion.

**Consequences:** Users lose trigger IDs and automation continuity. Recreating later may produce duplicate host records, new trigger IDs, missed events during gaps, or inability to resume after account reconnect. Accidental delete is especially damaging when the handoff file still references the old trigger.

**Prevention:**
- Make disable the default for “pause”, “stop receiving events”, disconnected account, billing/subscription, or temporary off states. Reserve delete for explicit “permanently delete”.
- Require `confirm: true` and exact `triggerId` for delete. Do not allow delete by broad filters in v1.
- Before delete, list/get the trigger and return a preview: slug, status, connected account ID, and any matching handoff record path. Then delete only if confirmed.
- Implement update/upsert without delete-recreate where Composio supports update/upsert.
- After delete/disable/enable, reconcile or annotate the automation handoff record so debug output can detect stale local references.

**Detection / warning signs:**
- Tool descriptions use “remove” ambiguously.
- Tests assert delete only by slug or user rather than exact trigger ID.
- Upsert implementation calls delete first.
- Debug output cannot tell whether a local automation record points at a deleted/disabled trigger.

**Phase should address:** Phase 3 (trigger lifecycle APIs) and Phase 5 (integration tests with real trigger instances).

**Confidence:** HIGH for disable/delete semantics from Composio trigger-management docs and project context.

### Pitfall 5: Schema drift from unpinned Composio tool and trigger versions

**What goes wrong:** The wrapper caches or hardcodes Composio tool/trigger schemas but executes against the latest server-side schema. Inputs generated from yesterday’s schema fail today, or worse, still validate locally but perform a different operation remotely.

**Why it happens:** Composio docs emphasize that tool argument schemas and trigger config schemas evolve; manual tool execution requires specific versions for stability and using `latest`/dynamic latest defeats pinning. The project exposes generic meta tools and trigger schema lookup, so schema drift is a core product risk.

**Consequences:** Runtime errors, broken automations, invalid trigger configs, failed multi-execute calls, and hard-to-debug differences between users. A major schema change can force a rewrite of wrappers and tests if version handling is not designed upfront.

**Prevention:**
- Never invent or guess tool, toolkit, trigger slugs, or versions. Always retrieve schemas from Composio discovery APIs/meta tools at runtime or use verified fixtures only for tests.
- Return schema metadata in `COMPOSIO_GET_TOOL_SCHEMAS` and trigger-schema tools, including version when available.
- For direct/manual tool execution paths, require or centrally configure explicit versions in production workflows; do not use `dangerouslySkipVersionCheck` outside tests/prototypes.
- Add contract tests using real Composio credentials that compare discovery schema → validation → execute/upsert for at least one harmless tool and one test trigger type.
- Store any cached schema with TTL and version tag; invalidate on version mismatch.

**Detection / warning signs:**
- Code contains hardcoded examples like `GMAIL_NEW_GMAIL_MESSAGE` or version strings outside tests/docs.
- Execution uses `latest`, omits version where the API expects one, or sets `dangerouslySkipVersionCheck: true`.
- Tests mock schemas only and never exercise real discovery.
- Users report “schema says field required but execute rejects it” errors.

**Phase should address:** Phase 2 (meta-tool wrappers), Phase 3 (trigger schema/upsert), Phase 5 (integration tests).

**Confidence:** HIGH from Composio local docs for version/schema drift; MEDIUM for exact API enforcement details without live Context7 verification.

### Pitfall 6: Broken npm install because opencode plugin packaging assumptions are wrong

**What goes wrong:** The npm package builds but opencode cannot load it, Bun startup install fails, TypeScript sources are not packaged or not transpiled as expected, dependencies are mistakenly left in devDependencies, or the package omits the entry point via an over-tight `files` allowlist.

**Why it happens:** opencode npm plugins are specified in `opencode.json` `plugin` array and installed automatically using Bun at startup into `~/.cache/opencode/node_modules/`. Local plugins can import dependencies only if a `package.json` exists in the config directory, while npm plugins rely on published package dependencies. npm packaging has several “always included/ignored” and `files` rules that differ from git.

**Consequences:** Users add `"plugin": ["composio-x-opencode"]` and opencode startup fails, plugin hooks never register tools/commands, or package works locally but fails from npm. This can look like an auth/Composio bug while actually being a packaging/load problem.

**Prevention:**
- Make the package entry point explicit (`main`/`exports`) and include built artifacts in `files`.
- Put runtime packages (`@opencode-ai/plugin`, Composio SDK/fetch deps if used at runtime) in `dependencies` or carefully documented peer dependencies; do not leave runtime-only imports in `devDependencies`.
- Include a smoke test that installs from the packed tarball into a fresh temp opencode config, starts opencode with `OPENCODE_CONFIG`/`OPENCODE_CONFIG_DIR`, and confirms custom tools are listed/usable.
- Run `npm pack` inspection in CI and fail if expected plugin entry, command files, README, or dist files are missing.
- Document both local development (`./local-plugin.ts` or `.opencode/plugins`) and npm usage (`plugin: ["composio-x-opencode"]`) separately.

**Detection / warning signs:**
- Local checkout works via `.opencode/plugins/*.ts`, but installing package by name does not.
- `npm pack` tarball lacks `dist/`, command templates, or package entry files.
- `package.json#files` was added for security but no packlist test verifies installability.
- opencode errors mention missing module/dependency during startup.

**Phase should address:** Phase 1 (minimal plugin skeleton) and Phase 4 (packaging/release).

**Confidence:** HIGH for opencode plugin install/load behavior and npm packaging rules from official docs.

### Pitfall 7: Tool/command name collisions with opencode built-ins or user tools

**What goes wrong:** The package names tools or commands generically (`bash`, `database`, `claim`, `debug`, `search`, `delete`) and accidentally overrides built-in opencode tools/commands or user-defined ones. Official docs state custom tools with the same name as built-ins take precedence and custom commands can override built-ins.

**Why it happens:** opencode derives custom tool names from filenames/exports and command names from filenames/config keys. Ports often preserve short names from the source integration without considering host namespace collisions.

**Consequences:** A user’s existing `/debug`, `/claim`, or built-in command behavior changes after installing the extension. Worse, naming a custom tool `bash` would replace built-in bash behavior. This creates confusing support cases and potential security bypasses.

**Prevention:**
- Prefix every public tool and command with `composio_` or `composio-` consistently: `composio_search_tools`, `composio_trigger_delete`, `/composio-claim`.
- Add a static test that enumerates exported tool/command names and rejects collisions with opencode built-ins and high-risk generic names.
- Avoid file/export layouts that produce unexpected names like `<filename>_<exportname>` unless tests assert final names.
- Document the exact names users should see in opencode.

**Detection / warning signs:**
- Tool files are named `bash.ts`, `search.ts`, `debug.ts`, `claim.ts`, or `delete.ts`.
- README uses multiple spellings for the same command/tool.
- Manual smoke test does not verify visible registered tool names.

**Phase should address:** Phase 1 (registration naming contract) before broader implementation.

**Confidence:** HIGH from official opencode custom-tools and commands docs.

### Pitfall 8: Treating signup/claim as idempotent without verifying identity state transitions

**What goes wrong:** First-use signup creates multiple anonymous identities, `composio_claim` claims the wrong identity, `COMPOSIO_API_KEY` is ignored after anonymous signup, or claim command/tool mutate credentials without clear user feedback.

**Why it happens:** The port must preserve `composio-x-pi` semantics but adapt to opencode commands/tools. Two entry points (`/composio-claim <email>` and `composio_claim`) and two auth sources increase state complexity. The signup endpoint behavior is project-specified but not independently verified in this research.

**Consequences:** Users lose access to automations associated with a previous anonymous identity, claim attempts fail silently, or CI unexpectedly uses a personal anonymous account instead of `COMPOSIO_API_KEY`. This can cause broken installs and support-heavy identity recovery.

**Prevention:**
- Model auth as an explicit state machine: `missing → anonymous_provisioned → claim_pending → claimed` and separately `env_key_present` as highest-priority override.
- Make signup idempotent: if anonymous credential file exists and parses, do not call signup again unless an explicit reset flow exists.
- Make claim return actionable status: email used, pending/complete state, auth source after claim, and next step. Redact tokens.
- Add tests for missing file, malformed file, env key present, anonymous file present, claim via command, claim via tool, and repeated signup/claim calls.
- In debug output, surface “env key overrides anonymous file” so users understand why claim appears unused in CI.

**Detection / warning signs:**
- Signup is called in each tool constructor/plugin initialization rather than lazily on first authenticated Composio operation.
- Claim command writes credential files without reading current identity first.
- Tests do not cover repeated signup or env-key precedence.

**Phase should address:** Phase 1 (auth/signup foundation) and Phase 2 (claim/debug tools).

**Confidence:** MEDIUM from project context; LOW for exact signup/claim API behavior because official endpoint docs were not located during this pitfalls-only research.

### Pitfall 9: Trigger leaks and duplicate subscriptions from weak upsert/list semantics

**What goes wrong:** Each create/upsert call creates a new active trigger instead of reusing/updating an existing one. The extension cannot list/filter triggers precisely by user, slug, connected account, or status, so cleanup misses duplicates.

**Why it happens:** Composio docs describe automatic reuse for identical trigger configs and filtered `getActiveTriggers`, but an HTTP-wrapper implementation can still choose unstable IDs, omit connected account, normalize config differently, or fail to reconcile existing triggers before creating/upserting.

**Consequences:** Users get duplicated emails/events, host automations run multiple times, Composio quotas/billing are consumed unexpectedly, and stale triggers keep firing after the user thinks they disabled an automation. Trigger leaks are hard to detect without list/debug tooling.

**Prevention:**
- Define a stable local automation key from trigger slug + user/connected account + normalized trigger config + handoff destination.
- Before create/upsert, list existing triggers with the narrowest available filters and compare normalized configs.
- Store returned `triggerId` in the handoff record and in debug output.
- Provide `composio_debug_info` checks for duplicate local automations and duplicate remote active triggers for the same normalized key.
- Add integration tests that call upsert twice and assert one effective trigger/local handoff record.

**Detection / warning signs:**
- Re-running the same opencode prompt creates multiple active triggers.
- Handoff file contains repeated records with different trigger IDs but same slug/config.
- There is no list-by-status/connected-account debug path.

**Phase should address:** Phase 3 (trigger lifecycle) and Phase 5 (integration tests).

**Confidence:** MEDIUM-HIGH from Composio local trigger docs; exact v3.1 HTTP upsert idempotency should be verified during implementation.

### Pitfall 10: Assuming the extension receives trigger events or owns webhook verification

**What goes wrong:** The opencode plugin tries to act as a trigger event receiver, opens local ports, or promises event delivery inside opencode. It may store webhook secrets or skip signature verification because the current project is “just local”.

**Why it happens:** The project includes trigger authoring and automation handoff, but explicitly excludes building a host webhook receiver. Composio trigger docs say production webhook receivers should verify signatures, use HTTPS, respond quickly, handle duplicates, and implement idempotency.

**Consequences:** Scope creep, security-sensitive server code inside a local editor plugin, unreliable trigger handling, and a future rewrite when a real host app needs proper webhook verification and queues. Users may believe automations are live when only trigger definitions were handed off.

**Prevention:**
- Keep v1 boundary crisp: create/upsert/list/enable/disable/delete trigger definitions and write handoff records; do not receive events.
- In tool results and docs, state what was created and what host-side webhook/automation reader must do next.
- Include host requirements in saved automation metadata if compatible: trigger slug, trigger ID, expected payload/schema/version, and desired handler instructions.
- Do not store webhook secrets in this package. If docs mention receiving events, point to Composio webhook verification guidance and mark it host responsibility.

**Detection / warning signs:**
- Implementation starts an HTTP server from the opencode plugin.
- README says “automations will run” without explaining host/Pi handoff consumption.
- Code imports web server frameworks only to receive trigger events.

**Phase should address:** Phase 2 (handoff docs/tool output) and Phase 3 (trigger authoring).

**Confidence:** HIGH from project out-of-scope constraints and Composio webhook docs.

## Moderate Pitfalls

### Pitfall 1: Invalid opencode config snippets that break startup

**What goes wrong:** README/install script tells users to add malformed config, wrong `plugin` shape, wrong `command` field (`prompt` instead of current `template`), or unsupported permission keys. opencode validates config strictly; unknown top-level keys are rejected by schema.

**Prevention:** Validate all docs examples against `https://opencode.ai/config.json`; include `$schema`; use `plugin: ["composio-x-opencode"]` or tuple form only; ensure command examples use `template` per current docs/schema; include escape hatches (`OPENCODE_DISABLE_PROJECT_CONFIG`, `OPENCODE_PURE`) in troubleshooting.

**Detection:** Fresh install smoke test cannot start opencode; users report config validation errors.

**Phase should address:** Phase 4 (docs/package smoke test).

**Confidence:** HIGH from official opencode config docs/schema.

### Pitfall 2: Forgetting opencode config/plugin load order and restart requirements

**What goes wrong:** Users install or change plugin/config and expect a running session to see new tools immediately. Project/global plugins interact unexpectedly because hooks run in load order and duplicate package handling differs from local files.

**Prevention:** Docs should say restart opencode after install/config changes. Manual smoke test should start from a fresh process. Avoid relying on hook order for safety; implement guards inside the tool itself.

**Detection:** “Tool not found” until restart; behavior differs between global and project install.

**Phase should address:** Phase 4 documentation and manual smoke test.

**Confidence:** HIGH from opencode plugin/config docs and loaded customize-opencode guidance.

### Pitfall 3: Returning huge or sensitive Composio outputs directly to the model

**What goes wrong:** Tool schema discovery, multi-execute responses, remote workbench output, or trigger lists return huge JSON blobs or sensitive payloads into opencode context.

**Prevention:** Add output shaping: summarize large lists, paginate where possible, redact secrets, and expose raw JSON only behind explicit `includeRaw`/debug flags. Recommend opencode `tool_output` limits in docs for heavy users.

**Detection:** Context fills quickly; logs/transcripts contain OAuth URLs, auth errors with tokens, or full remote command output.

**Phase should address:** Phase 2 wrappers and Phase 5 integration tests.

**Confidence:** MEDIUM; opencode supports tool output limits, but exact Composio response sizes need empirical validation.

### Pitfall 4: Over-mocking integration tests so auth and trigger failures ship unnoticed

**What goes wrong:** Unit tests mock all Composio APIs and file I/O, so the first real user hits missing connected account errors, schema validation failures, or trigger permission issues.

**Prevention:** Keep fast unit tests, but add opt-in integration tests gated by `COMPOSIO_API_KEY` and safe fixture settings. Cover signup fallback separately from env-key mode. Ensure integration tests never call destructive remote bash/workbench by default.

**Detection:** High test coverage but manual smoke fails at first authenticated call.

**Phase should address:** Phase 5 (integration and manual smoke tests).

**Confidence:** MEDIUM-HIGH based on Composio docs emphasizing real connected account/auth errors and project integration-test requirement.

## Minor Pitfalls

### Pitfall 1: Inconsistent naming between Composio slugs and opencode-friendly tool names

**What goes wrong:** Users cannot discover the right tools because docs switch between `COMPOSIO_SEARCH_TOOLS`, `composio_search_tools`, and `search_tools` without mapping.

**Prevention:** Publish a canonical mapping table. Use lowercase snake_case for opencode tools and uppercase Composio slugs only when referring to upstream meta tools.

**Phase should address:** Phase 1 naming and Phase 4 docs.

**Confidence:** MEDIUM.

### Pitfall 2: Platform-specific path handling for `~/.config/pi` and `~/.composio`

**What goes wrong:** Tilde expansion, Windows paths, or parent directory creation fails. Although primary environment may be macOS/Linux, npm packages may install elsewhere.

**Prevention:** Use robust home-directory resolution (`os.homedir()`), avoid shell expansion for paths, and test env/per-call overrides with absolute temp paths.

**Phase should address:** Phase 2 file persistence.

**Confidence:** MEDIUM.

### Pitfall 3: Poor error taxonomy in tool outputs

**What goes wrong:** Missing API key, missing connected account, invalid trigger config, network failure, and permission-denied all return the same generic error.

**Prevention:** Normalize errors into actionable categories with remediation: `missing_auth`, `signup_failed`, `connection_required`, `schema_validation_failed`, `destructive_confirmation_required`, `remote_execution_failed`, `trigger_not_found`.

**Phase should address:** Phase 2 and Phase 3.

**Confidence:** MEDIUM-HIGH from Composio docs showing distinct connected-account/validation/tool errors.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Phase 1: opencode plugin skeleton and registration | Broken startup from wrong plugin export shape, config shape, dependency placement, or name collisions | Build the smallest plugin first; validate against `opencode.ai/config.json`; static-test tool/command names; smoke-test local and npm-style loading |
| Phase 1: auth/signup/debug foundation | Credential leaks and duplicate anonymous identities | Central auth module; auth state machine; idempotent signup; debug redaction tests; `COMPOSIO_API_KEY` precedence tests |
| Phase 2: Composio meta-tool wrappers | Destructive tools exposed without guardrails; schema drift from unverified slugs | Risk-classify tools; explicit confirmation for destructive wrappers; runtime schema discovery; avoid guessed slugs/versions |
| Phase 2: automation handoff | Breaking Pi compatibility or losing records via overwrite | Compatibility fixture; strict path precedence; atomic writes; preserve unknown fields; duplicate/upsert tests |
| Phase 3: trigger lifecycle APIs | Disable/delete confusion, duplicate triggers, trigger leaks | Disable by default; delete requires `confirm` + exact ID; list/filter before upsert; reconcile handoff records; integration test repeated upsert |
| Phase 3: trigger schemas | Invalid configs from stale schema | Fetch schema from Composio; include version metadata; add contract tests with safe trigger types |
| Phase 4: npm distribution and docs | Published tarball omits dist or includes secrets; install docs break opencode | `files` allowlist; `npm pack` inspection; fresh install smoke; schema-validated docs snippets; troubleshooting restart/escape hatches |
| Phase 5: integration/manual smoke | Real Composio auth/connection failures hidden by mocks | Opt-in `COMPOSIO_API_KEY` tests; safe test tools only; skip destructive remote bash/workbench unless explicitly enabled |

## Sources

- OpenCode official config schema, fetched 2026-05-15: `https://opencode.ai/config.json` — HIGH confidence for config fields, permission shape, plugin array shape, MCP/tool output fields.
- OpenCode official Plugins docs, last updated 2026-05-15: `https://opencode.ai/docs/plugins/` — HIGH confidence for npm plugin loading with Bun, plugin directories, load order, plugin function/hook shape, custom tool registration from plugins, structured logging recommendation.
- OpenCode official Custom Tools docs, last updated 2026-05-15: `https://opencode.ai/docs/custom-tools/` — HIGH confidence for tool locations, tool helper/Zod args, filename/export naming, and built-in tool collision behavior.
- OpenCode official Permissions docs, last updated 2026-05-15: `https://opencode.ai/docs/permissions/` — HIGH confidence for permissive defaults, `ask/allow/deny`, last-match rule behavior, `.env` read denial, `external_directory`, and per-agent permission precedence.
- OpenCode official Commands docs, last updated 2026-05-15: `https://opencode.ai/docs/commands/` — HIGH confidence for command file/config shape, `$ARGUMENTS`, shell-output interpolation, and built-in command override behavior.
- OpenCode official Config docs, last updated 2026-05-15: `https://opencode.ai/docs/config/` — HIGH confidence for config precedence, global/project locations, plugin config, variable substitution, `tool_output`, and npm plugin usage.
- npm official `package.json` docs, npm CLI v10.9.8: `https://docs.npmjs.com/cli/v10/configuring-npm/package-json` — HIGH confidence for `files`, `main`, `exports`, `bin`, dependencies/devDependencies, `private`, `publishConfig`, package name/version requirements.
- npm official developers guide, last edited 2022-10-05: `https://docs.npmjs.com/cli/v10/using-npm/developers` — HIGH confidence for `npm pack` testing and warning that package folder contents are exposed by default when publishing.
- Local Composio skill docs: `/Users/tri/.agents/skills/composio/rules/app-execute-tools.md` — MEDIUM-HIGH confidence for direct tool execution, version requirement, error handling, and slug verification; not independently verified through Context7 in this run.
- Local Composio skill docs: `/Users/tri/.agents/skills/composio/rules/app-tool-versions.md` — MEDIUM-HIGH confidence for schema drift/version pinning and `dangerouslySkipVersionCheck` risks; not independently verified through Context7 in this run.
- Local Composio skill docs: `/Users/tri/.agents/skills/composio/rules/triggers-create.md` — MEDIUM-HIGH confidence for trigger creation, automatic reuse, trigger version pinning, discovery, and connected-account errors.
- Local Composio skill docs: `/Users/tri/.agents/skills/composio/rules/triggers-manage.md` — MEDIUM-HIGH confidence for enable/disable/update/delete semantics, delete permanence, filters, and cleanup patterns.
- Local Composio skill docs: `/Users/tri/.agents/skills/composio/rules/triggers-webhook.md` — MEDIUM-HIGH confidence for webhook verification, HTTPS/signature/idempotency guidance, and host receiver responsibilities.
- Project context: `/Users/tri/composio-x-opencode/.planning/PROJECT.md` — HIGH confidence for project-specific requirements and constraints; LOW-MEDIUM confidence for exact composio-x-pi behavior beyond the summarized README details.

## Research Gaps / Follow-Up Needed

- Verify live Composio API docs or SDK types for the exact v3.1 trigger lifecycle request/response schemas, especially upsert idempotency, delete response shape, and available filters.
- Locate and inspect the actual `composio-x-pi` package README/code before implementing automation handoff schema and signup/claim behavior; current research only has the project summary.
- Verify current `@opencode-ai/plugin` package exports and TypeScript types in the project implementation phase; official docs show examples but package-level API should be pinned by tests.
- Confirm whether opencode permissions can target plugin custom tool names exactly in all current interfaces; docs imply permissions are keyed by tool name, but a real smoke test should validate custom-tool permission prompts.
