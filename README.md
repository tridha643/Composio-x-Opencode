# composio-x-opencode

`composio-x-opencode` is an opencode plugin that exposes Composio auth, tool discovery, tool execution, remote sandbox, trigger lifecycle, diagnostics, and Pi-compatible automation handoff tools inside opencode.

The v1 surface is intentionally small and stable. It does not generate one opencode tool per Composio app. Agents should discover Composio capabilities at runtime, inspect schemas, manage connections, then execute or create triggers.

## Status

The local checkout supports the v1 tool surface, first-use signup/claim, Composio meta tools, trigger lifecycle tools, and Pi-compatible automation handoff.

The npm package name, install shape, local pack audit, and fresh tarball install smoke test are covered by the local release checks below.

## Installation

### From npm

After the package is published, add it to your opencode config:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["composio-x-opencode"]
}
```

opencode installs npm plugins with Bun when it loads the config.

### From a local checkout

Build the plugin:

```bash
bun install
bun run build
```

Load the built plugin from an opencode config:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["./dist/index.js"]
}
```

The repository also includes `examples/opencode.local.jsonc` with this local plugin shape.

## Claim Command

The plugin registers the `composio_claim` tool. For a human-facing slash command, define `/composio-claim` in opencode config:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "command": {
    "composio-claim": {
      "description": "Claim the anonymous Composio organization for a human email",
      "template": "Validate $ARGUMENTS as exactly one email address. Then call the composio_claim tool with { \"email\": \"$ARGUMENTS\" }. Summarize the claim status, requested email, whether an invite is present, and next steps. Never print API keys, agent keys, Authorization headers, raw anonymous credential JSON, or raw invite codes. If the anonymous identity is missing, tell the user to run composio_signup first."
    }
  }
}
```

For local development, this repository includes `.opencode/commands/composio-claim.md`. The same template is also available at `examples/commands/composio-claim.md`.

## Credentials

Credential resolution order is:

1. `COMPOSIO_API_KEY`
2. `~/.composio/anonymous_user_data.json`
3. Missing credentials with guidance to run `composio_signup`

`COMPOSIO_API_KEY` always wins. This supports CI and users with existing Composio API keys.

To store a Composio API key from opencode without pasting it into chat, use:

```text
/composio-set-api-key
```

The command rejects API keys passed as slash-command arguments, prompts locally with hidden input, writes `~/.composio/anonymous_user_data.json`, and sets restrictive file permissions. It uses `/dev/tty` when available and falls back to a macOS hidden GUI prompt when opencode's shell runner has no interactive TTY.

If `COMPOSIO_API_KEY` is already set in opencode's environment, that environment value still takes precedence over the stored file. Restart opencode with `COMPOSIO_API_KEY` fixed or unset before the stored file can be used.

`composio_signup` provisions or reuses an anonymous Composio identity and persists credentials to `~/.composio/anonymous_user_data.json` with restrictive file permissions where the platform supports them.

`composio_claim` requests handoff of the anonymous Composio organization to a human email address. The `/composio-claim <email>` command should call the same tool.

`composio_debug_info` is local and network-free. It reports version, auth source, anonymous credential file metadata, handoff path, and registered tool names without printing secrets.

The plugin redacts API keys, agent keys, Authorization headers, anonymous credential secrets, and raw invite codes from tool outputs and normalized errors.

## Tool Namespace

All public tools are lowercase and `composio_`-prefixed except `save_automation_definition`, which intentionally preserves the Pi-compatible automation handoff name.

| Tool | Category | Risk | Purpose |
|---|---|---|---|
| `composio_debug_info` | diagnostics | safe | Show redacted local runtime, auth, handoff, and registered-tool diagnostics. |
| `composio_signup` | auth | auth | Provision or reuse first-use anonymous Composio credentials. |
| `composio_claim` | auth | auth | Request email handoff for an anonymous Composio identity. |
| `composio_search_tools` | meta | network | Search Composio's tool catalog by use case. |
| `composio_get_tool_schemas` | meta | network | Fetch exact Composio tool schemas for known tool slugs. |
| `composio_manage_connections` | meta | auth | Inspect or initiate connected-account auth flows. |
| `composio_multi_execute_tool` | meta | network | Execute one or more third-party Composio app tools. May mutate external services. |
| `composio_remote_bash_tool` | remote | open_world | Run bash in Composio's remote sandbox, not locally. |
| `composio_remote_workbench` | remote | open_world | Run Python in Composio's persistent remote workbench sandbox, not locally. |
| `composio_list_trigger_types` | trigger | network | List trigger types before authoring a trigger. |
| `composio_get_trigger_type_schema` | trigger | network | Fetch exact trigger configuration schema. |
| `composio_create_trigger` | trigger | network | Create or upsert a Composio trigger instance. |
| `composio_list_triggers` | trigger | network | List existing trigger instances before mutation. |
| `composio_enable_trigger` | trigger | destructive | Enable an exact trigger instance and resume event delivery. |
| `composio_disable_trigger` | trigger | destructive | Disable an exact trigger instance and pause event delivery. |
| `composio_delete_trigger` | trigger | destructive | Permanently delete an exact trigger instance. Requires `confirm: true`. |
| `save_automation_definition` | handoff | local_write | Write a Pi-compatible automation handoff record to a local JSON file. |

## Recommended Permissions

opencode permissions default to permissive behavior for most tools. For Composio-backed workflows, set approval prompts on tools that can change auth state, mutate external services, run remote code, change trigger delivery, delete triggers, or write local handoff files.

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "permission": {
    "composio_manage_connections": "ask",
    "composio_multi_execute_tool": "ask",
    "composio_remote_bash_tool": "ask",
    "composio_remote_workbench": "ask",
    "composio_enable_trigger": "ask",
    "composio_disable_trigger": "ask",
    "composio_delete_trigger": "ask",
    "save_automation_definition": "ask"
  }
}
```

For stricter projects, start from a global prompt and explicitly allow read-only discovery tools:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "permission": {
    "*": "ask",
    "composio_debug_info": "allow",
    "composio_search_tools": "allow",
    "composio_get_tool_schemas": "allow",
    "composio_list_trigger_types": "allow",
    "composio_get_trigger_type_schema": "allow",
    "composio_list_triggers": "allow"
  }
}
```

The plugin does not mutate opencode permission config automatically. Permission automation is intentionally out of scope for v1 because user and organization policy should remain explicit.

Custom-tool permission prompts should be validated in a real opencode session before release. That live prompt validation belongs to the automated verification and smoke-test phase.

## Workflows

### Check Runtime State

Run `composio_debug_info` first when diagnosing setup. It does not contact Composio and should show:

1. plugin version
2. auth source
3. anonymous credential file presence
4. automation handoff path
5. registered tool names

### First-Use Signup And Claim

Run `composio_signup` when no `COMPOSIO_API_KEY` or anonymous credential file exists.

Run `composio_claim` or `/composio-claim <email>` when a human should take over the anonymous Composio organization.

### Schema-First Tool Execution

Use this order for third-party Composio tools:

1. `composio_search_tools` to discover candidate tool slugs for a use case.
2. `composio_get_tool_schemas` to inspect exact required inputs.
3. `composio_manage_connections` if the selected toolkit requires account authentication.
4. `composio_multi_execute_tool` to execute selected tools.

Do not guess Composio tool slugs or input fields.

### When A Connection Is Required

If Composio refuses a tool call because a toolkit account is not connected, the plugin returns a `COMPOSIO_CONNECTION_REQUIRED` result instead of a raw upstream error when it can identify the connection state.

When Composio returns a hosted connection URL, opencode output shows a readable Markdown link such as `Connect Slack`. Open that link manually, complete authorization in Composio, then retry the original tool call.

When Composio reports a missing connection but does not return a URL yet, the output tells the agent to call `composio_manage_connections` for the required toolkit. That tool can return the hosted connection link.

The plugin does not call `composio link`, shell out to the Composio CLI, auto-open a browser, or mutate opencode config/permissions. Connection links are rendered for the user to open explicitly.

### Remote Sandbox And Workbench

`composio_remote_bash_tool` runs commands in Composio's remote sandbox. It does not run local shell commands.

`composio_remote_workbench` runs Python in Composio's persistent remote workbench. It does not execute local Python.

Treat both as open-world remote code execution and require approval for untrusted prompts.

### Trigger Lifecycle

Use this order for trigger authoring:

1. `composio_list_trigger_types` to discover trigger types.
2. `composio_get_trigger_type_schema` to inspect `trigger_config` requirements.
3. `composio_manage_connections` if the trigger requires a connected account.
4. `composio_create_trigger` to create or upsert a trigger instance.
5. `save_automation_definition` to write host automation metadata when the trigger should be handed off to a Pi-compatible runner.
6. `composio_list_triggers` to inspect existing trigger IDs and status before lifecycle changes.
7. `composio_disable_trigger` to pause event delivery without deleting the trigger.
8. `composio_enable_trigger` to resume event delivery.
9. `composio_delete_trigger` only for permanent cleanup. It requires an exact `trigger_id` and `confirm: true`.

Disable is a pause operation. Delete is permanent cleanup.

## Pi-Compatible Automation Handoff

`save_automation_definition` writes automation metadata for a host application or Pi-compatible automation runner to read.

Path precedence is:

1. tool argument `filePath`
2. `PI_COMPOSIO_AUTOMATIONS_JSON`
3. `~/.config/pi/composio-automations.json`

Relative `filePath` values resolve from the opencode tool context directory.

The handoff file is a JSON array. Records are upserted by `triggerId`, unrelated records are preserved, and unknown fields on updated records are preserved.

Record shape:

```json
{
  "name": "Example automation",
  "triggerId": "trigger_123",
  "triggerSlug": "github_star_created",
  "instructions": "When this trigger fires, summarize the event.",
  "enabled": true,
  "metadata": {},
  "updatedAt": "2026-05-20T00:00:00.000Z"
}
```

The plugin writes the handoff file only. It does not host a webhook receiver or run the automation after handoff.

## Testing And Smoke Checks

Local verification:

```bash
bun run verify
```

`bun run verify` runs typecheck, build, unit tests, default integration tests, and the local build smoke check. It does not run destructive live Composio operations by default.

Local release readiness:

```bash
bun run release:check
```

`bun run release:check` runs `verify`, rebuilds the package, runs `publint`, audits the npm tarball contents, and installs the packed tarball into a fresh temporary project to verify the package-name import path registers the same tools. It is also wired to `prepublishOnly`.

Release checks can be run individually:

```bash
bun run pack:check
bun run smoke:tarball
```

`pack:check` fails if required files are missing or forbidden files are included. Required files include `package.json`, `README.md`, `LICENSE`, `dist/index.js`, and `dist/index.d.ts`. Forbidden files include planning docs, local opencode config/cache files, source/tests/scripts, environment files, credential files, claim reports, automation handoff JSON, tarballs, and sourcemaps.

Live signup verification is opt-in:

```bash
RUN_COMPOSIO_LIVE_AGENT_TESTS=1 bun test test/integration/live-agent-signup.test.ts
```

Full live Composio E2E verification is also opt-in and requires a disposable trigger fixture. It creates or updates a trigger, writes a temporary handoff file, disables/enables/disables the trigger, then deletes it during cleanup:

```bash
RUN_COMPOSIO_LIVE_E2E_TESTS=1 \
COMPOSIO_API_KEY=... \
COMPOSIO_LIVE_TOOL_SCHEMA_SLUG=... \
COMPOSIO_LIVE_TRIGGER_SLUG=... \
COMPOSIO_LIVE_TRIGGER_CONFIG_JSON='{"example":"initial"}' \
COMPOSIO_LIVE_TRIGGER_UPDATED_CONFIG_JSON='{"example":"updated"}' \
bun test test/integration/live-composio-e2e.test.ts --timeout 180000
```

Set `COMPOSIO_LIVE_CONNECTED_ACCOUNT_ID` when the trigger fixture needs a specific connected account. Set `COMPOSIO_LIVE_TRIGGER_TOOLKIT_SLUG` to narrow trigger-type listing for the fixture toolkit.

Useful environment variables:

| Variable | Purpose |
|---|---|
| `COMPOSIO_API_KEY` | Highest-precedence Composio credential source for real API calls. |
| `RUN_COMPOSIO_LIVE_AGENT_TESTS=1` | Enables opt-in live anonymous signup test coverage. |
| `RUN_COMPOSIO_LIVE_E2E_TESTS=1` | Enables opt-in live Composio E2E coverage, including trigger mutation and cleanup. |
| `COMPOSIO_LIVE_TOOL_SCHEMA_SLUG` | Safe Composio tool slug to inspect during live E2E schema coverage. |
| `COMPOSIO_LIVE_TRIGGER_SLUG` | Disposable trigger type slug to create/update during live E2E coverage. |
| `COMPOSIO_LIVE_TRIGGER_CONFIG_JSON` | Initial JSON object for the disposable live trigger fixture. |
| `COMPOSIO_LIVE_TRIGGER_UPDATED_CONFIG_JSON` | Updated JSON object for the disposable live trigger fixture. |
| `COMPOSIO_LIVE_CONNECTED_ACCOUNT_ID` | Optional connected account ID for trigger fixtures that require one. |
| `COMPOSIO_LIVE_TRIGGER_TOOLKIT_SLUG` | Optional toolkit filter used while listing trigger types in live E2E coverage. |
| `PI_COMPOSIO_AUTOMATIONS_JSON` | Overrides the default automation handoff path. |

Manual opencode smoke flow before release:

1. Build the plugin with `bun run build`.
2. Load `./dist/index.js` from an opencode config.
3. Run `composio_debug_info` and confirm the registered tool list is complete.
4. Run `composio_signup` in an isolated test home or with known disposable credentials.
5. Search and inspect a safe Composio tool schema.
6. List trigger types and inspect a safe trigger schema.
7. Create or update a disposable trigger only when you have a safe fixture account.
8. Run `save_automation_definition` with a temporary `filePath` or `PI_COMPOSIO_AUTOMATIONS_JSON`.
9. Use `composio_list_triggers` to confirm the trigger ID.
10. Use `composio_disable_trigger` to pause test trigger delivery.
11. Use `composio_enable_trigger` to confirm resume behavior on the disposable fixture.
12. Use `composio_disable_trigger` again before cleanup.
13. Use `composio_delete_trigger` with `confirm: true` to permanently clean up the disposable trigger.
14. Configure `permission` entries from the Recommended Permissions section and confirm prompts target the exact custom tool names.

For permission prompt validation, trigger prompts for `composio_multi_execute_tool`, `composio_remote_bash_tool`, `composio_remote_workbench`, trigger lifecycle tools, and `save_automation_definition`. Deny remote bash/workbench prompts during smoke validation unless the fixture remote environment is disposable and approval is explicit.

Do not run remote bash, remote workbench, destructive trigger operations, or third-party mutation tools in live tests unless the fixture account is disposable and approval is explicit.

## Out Of Scope

These are intentional v1 boundaries, not missing README steps.

| Out of scope | What to use instead |
|---|---|
| Per-app opencode tool generation | Use `composio_search_tools`, `composio_get_tool_schemas`, and `composio_multi_execute_tool`. |
| Replacing Composio auth, execution, sandboxing, or trigger infrastructure | Delegate to Composio through the plugin tools. |
| Hosted webhook receiver or automation runner | Use a host application or Pi-compatible runner that consumes the handoff file. |
| New automation file format | Use the Pi-compatible JSON array at `~/.config/pi/composio-automations.json` or an override path. |
| UI/dashboard | Use opencode tools, slash commands, and Composio's own product surfaces. |
| Automatic opencode permission mutation | Apply explicit `permission` snippets in user, project, or managed opencode config. |
| Hosted CI or automatic npm publishing | Use local `release:check` and publish manually when ready. |
| Full live Composio/opencode smoke validation | Covered by the automated verification and smoke-test phase. |
| Advanced trigger/tool version management UI | Use schema/version fields exposed by the current tools where available. |

## Local Release Checklist

1. Run `bun run release:check`.
2. Optionally run the live E2E command above against disposable Composio fixtures.
3. Optionally run `npm publish --dry-run` for a final local npm preview.
4. Publish manually from a clean worktree when the local checks and optional live checks match the intended release.

The package does not mutate opencode configuration or permissions during release checks. Users still apply explicit `plugin`, `command`, and `permission` config snippets themselves.
