# composio-x-opencode

## What This Is

`composio-x-opencode` is a publishable opencode extension package that installs Composio-backed runtime and trigger-authoring tools into opencode. It ports the behavior of the existing `composio-x-pi` package into opencode, keeping the Pi-compatible automation handoff path while exposing Composio meta tools, trigger lifecycle APIs, signup, claim, and debug capabilities as opencode tools and commands.

The product is for opencode users and agents that need to discover, authenticate, execute, and author Composio automations without manually configuring Composio first.

## Core Value

An opencode agent can use Composio’s full meta-tool and trigger-authoring surface with no manual setup, including first-use signup, tool execution, trigger creation, and automation handoff.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Package installs as an opencode extension/plugin from a local checkout during development and as a publishable npm package for release.
- [ ] Extension registers Composio runtime/meta tools in opencode, including search, schema lookup, connection management, multi-tool execution, remote bash, and remote workbench.
- [ ] Extension registers trigger-authoring tools for listing trigger types, reading trigger schemas, creating/upserting triggers, listing triggers, enabling/disabling triggers, and deleting triggers.
- [ ] Extension provides first-use Composio identity provisioning through `composio_signup` with no required setup for new users.
- [ ] Extension supports org handoff through both a `/composio-claim <email>` command and a `composio_claim` tool.
- [ ] Extension reads credentials from `COMPOSIO_API_KEY` first, then falls back to stored anonymous credentials at `~/.composio/anonymous_user_data.json`.
- [ ] Extension writes automation handoff data with `save_automation_definition`, defaulting to `~/.config/pi/composio-automations.json` for Pi compatibility.
- [ ] Extension supports overriding the automation handoff path via `PI_COMPOSIO_AUTOMATIONS_JSON` and per-call `filePath`.
- [ ] Extension includes debug information through `composio_debug_info` so users can verify runtime, auth source, registered tools, and handoff path.
- [ ] Extension ships with tests, typecheck, build, integration-test hooks, and manual opencode smoke-test instructions.

### Out of Scope

- Generating one opencode tool per Composio app/tool — v1 wraps Composio meta tools rather than mirroring thousands of app-specific tools.
- Replacing Composio’s auth, execution, sandboxing, or trigger infrastructure — the extension delegates to Composio APIs.
- Building a host application webhook receiver — webhook/ngrok delivery verification belongs to the host app that consumes the automation handoff file.
- Creating a new automation file format — v1 intentionally preserves the Pi-compatible `composio-automations.json` handoff format.
- Building a full UI — v1 is an opencode extension package with tools, commands, docs, and tests.

## Context

- The reference behavior comes from the `composio-x-pi` package README. That package installs through Pi, provisions a Composio identity on first use, stores anonymous credentials in `~/.composio/anonymous_user_data.json`, supports `/composio-claim <email>`, and writes automation handoff records to `~/.config/pi/composio-automations.json`.
- The opencode version should preserve the useful runtime semantics of `composio-x-pi` while adapting extension registration, commands, and tools to opencode’s plugin/custom-tool system.
- Official Composio docs identify these meta tools as session-level tools for discovery, execution, authentication, and sandboxing: `COMPOSIO_GET_TOOL_SCHEMAS`, `COMPOSIO_MANAGE_CONNECTIONS`, `COMPOSIO_MULTI_EXECUTE_TOOL`, `COMPOSIO_REMOTE_BASH_TOOL`, `COMPOSIO_REMOTE_WORKBENCH`, and `COMPOSIO_SEARCH_TOOLS`.
- Official Composio trigger lifecycle endpoints in scope:
  - `POST https://backend.composio.dev/api/v3.1/trigger_instances/{slug}/upsert` to create or update a trigger instance.
  - `PATCH https://backend.composio.dev/api/v3.1/trigger_instances/manage/{triggerId}` with status `enable` or `disable`.
  - `DELETE https://backend.composio.dev/api/v3.1/trigger_instances/manage/{triggerId}` to permanently delete a trigger instance.
- User explicitly wants all meta tools included in v1, including the destructive/open-world tools such as remote bash and remote workbench.
- The package name should likely be `composio-x-opencode` to match the repository and the `composio-x-pi` naming pattern.

## Constraints

- **Compatibility**: Keep `~/.config/pi/composio-automations.json` as the default automation handoff file — this preserves compatibility with the Pi/host automation reader.
- **Credential precedence**: `COMPOSIO_API_KEY` must take precedence over stored anonymous signup credentials — supports CI and power users.
- **Credential storage**: Anonymous signup credentials must reuse `~/.composio/anonymous_user_data.json` — avoids inventing a separate opencode credential store for v1.
- **Setup**: No setup should be required for new users — first Composio tool use should be able to provision credentials through `composio_signup`.
- **Security**: Remote bash, remote workbench, connection management, multi-execute, trigger delete, and trigger enable/disable are destructive/open-world operations — tool descriptions, docs, and recommended opencode permissions must make this explicit.
- **Distribution**: Build as a publishable npm package while supporting local checkout development and local opencode smoke tests.
- **Testing**: Release readiness requires automated unit tests, typecheck, build, and optional integration tests with real Composio credentials and trigger config.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build an opencode extension/plugin, not a general app | The goal is to give opencode agents Composio-backed tools directly inside opencode. | — Pending |
| Port behavior from `composio-x-pi` | The Pi package already defines the desired signup, claim, trigger authoring, and automation handoff behavior. | — Pending |
| Include all Composio meta tools in v1 | User explicitly wants all meta tools, including remote bash and remote workbench. | — Pending |
| Preserve `~/.config/pi/composio-automations.json` | Host automation handoff should remain compatible with the Pi integration path. | — Pending |
| Reuse `~/.composio/anonymous_user_data.json` | Keeps credential behavior compatible with the reference package and avoids extra setup. | — Pending |
| Provide both `/composio-claim <email>` and `composio_claim` | User wants both command and tool forms for org handoff. | — Pending |
| Expose generic Composio wrappers instead of per-app tool generation | Meta tools let Composio handle discovery/execution without registering thousands of opencode tools. | — Pending |

---
*Last updated: 2026-05-15 after initialization*
