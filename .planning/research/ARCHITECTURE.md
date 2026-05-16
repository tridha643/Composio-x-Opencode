# Architecture Patterns

**Domain:** publishable opencode plugin package exposing Composio APIs as agent tools and commands  
**Project:** composio-x-opencode  
**Researched:** 2026-05-15  
**Overall confidence:** HIGH for opencode plugin/custom-tool mechanics and Composio v3.1 endpoint existence; MEDIUM for exact signup/claim payloads because `agents.composio.dev/api/signup` rejects unauthenticated GET and needs implementation-time verification against `composio-x-pi` or live POST behavior.

## Recommended Architecture

Build `composio-x-opencode` as a single npm-distributed opencode plugin whose exported plugin function registers a bounded set of custom tools and injects one `/composio-claim` command into the merged opencode config. Keep Composio behavior in framework-agnostic service modules, and keep opencode-specific code thin: registration, tool schemas, command prompt, logging, and permission guidance only.

The central architectural choice is **static opencode tools over generated per-app tools**. Register the fixed v1 surface (`composio_search_tools`, `composio_get_tool_schemas`, `composio_manage_connections`, `composio_multi_execute_tool`, `composio_remote_bash_tool`, `composio_remote_workbench`, trigger lifecycle tools, signup/claim/debug, and automation handoff). These tools call Composio's tool-router/meta-tool and trigger endpoints at runtime. This matches the project scope and avoids loading thousands of app-specific tools into opencode.

```text
opencode startup
  └─ loads npm/local plugin: composio-x-opencode
       ├─ config hook: adds /composio-claim command prompt
       └─ tool registry: registers fixed Composio tools

agent tool call
  └─ opencode custom tool wrapper
       ├─ safety classifier / argument validation
       ├─ credential resolver
       │    ├─ COMPOSIO_API_KEY
       │    └─ ~/.composio/anonymous_user_data.json
       ├─ Composio API client
       │    ├─ tool router session and meta-tool execution
       │    ├─ trigger type / trigger instance endpoints
       │    └─ signup / claim endpoints
       └─ response normalizer
            └─ user-readable result + optional structured JSON

automation handoff call
  └─ save_automation_definition
       ├─ validate Pi-compatible record
       ├─ resolve target path: per-call filePath → PI_COMPOSIO_AUTOMATIONS_JSON → ~/.config/pi/composio-automations.json
       ├─ create parent directory
       └─ atomic read-modify-write JSON file update
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| `src/plugin.ts` opencode adapter | Export the plugin function, instantiate services, register tools via `tool({ ... })`, mutate config to add `/composio-claim`, and use opencode logging. It must not contain Composio HTTP details. | opencode plugin runtime, tool modules, command registrar, service factory |
| `src/tools/*` tool definitions | One file per public tool family. Define opencode/Zod argument schemas, descriptions, safe defaults, and execute handlers. Convert opencode calls into service calls. | opencode tool API, safety gate, auth service, Composio services |
| `src/commands/register.ts` | Inject command config for `composio-claim` using the plugin `config(cfg)` hook. The command should prompt the current agent to call `composio_claim` with the supplied email rather than embedding secrets or shell commands. | opencode config object, `composio_claim` tool |
| `src/auth/credential-resolver.ts` | Resolve credentials deterministically: `COMPOSIO_API_KEY` first, then anonymous credential file. Return source metadata for debug without exposing secret values. | environment, filesystem, debug service, Composio client |
| `src/auth/signup-service.ts` | Provision first-use anonymous credentials and persist them to `~/.composio/anonymous_user_data.json` with safe file permissions. Encapsulate `https://agents.composio.dev/api/signup` behavior. | Composio signup API, credential store |
| `src/auth/claim-service.ts` | Implement org/user handoff for `composio_claim` using stored anonymous identity plus supplied email. | credential resolver, Composio claim/signup API |
| `src/composio/client.ts` | Low-level HTTP client: base URLs, headers, timeouts, JSON parsing, error normalization, retry policy for safe idempotent requests only. | Composio backend v3.1, signup API |
| `src/composio/tool-router.ts` | Manage Composio tool-router session creation/attachment and execute the six meta tools through `/api/v3.1/tool_router/session/{session_id}/execute_meta`. Cache session IDs per opencode session when possible. | Composio client, credential resolver, opencode tool context |
| `src/composio/triggers.ts` | Implement trigger type discovery and trigger instance lifecycle over official v3.1 endpoints. No opencode-specific logic. | Composio client |
| `src/automation/handoff-store.ts` | Read/write Pi-compatible automation JSON. Own path resolution, migration-free compatibility, locking/atomic writes, and validation. | filesystem, path resolver, tool definitions |
| `src/safety/policies.ts` | Classify risky operations (remote bash, remote workbench, multi-execute, connection management, trigger enable/disable/delete, file handoff writes), attach warning metadata, and enforce package-level guardrails that opencode permissions cannot express. | tool definitions, debug info |
| `src/debug/debug-info.ts` | Produce redacted runtime diagnostics: package version, opencode context, credential source, configured base URLs, tool names, trigger endpoint availability, handoff path, and last error summaries. | all services; never returns secrets |
| `src/shared/schema.ts` | Shared Zod schemas/types for trigger inputs, meta-tool passthrough payloads, automation records, and normalized API errors. | tools, services, tests |
| `test/*` | Unit tests with mocked HTTP/filesystem, contract tests for tool schemas, optional integration tests gated by real credentials, and manual opencode smoke fixture. | all components |

## Data Flow

### 1. opencode startup and registration flow

1. User config includes the package in `plugin`, e.g. `"plugin": ["composio-x-opencode"]`, or a local path during development.
2. opencode installs npm plugins with Bun into its plugin cache and loads plugin sources from global config, project config, global plugin directory, then project plugin directory. Official docs say hooks run in sequence and duplicate npm package/version pairs are loaded once.
3. `src/plugin.ts` creates a service container with package options, environment access, filesystem access, and HTTP client factories.
4. The plugin returns:
   - `tool: { ... }` with all fixed Composio tool definitions.
   - `config(cfg)` hook that adds or preserves `cfg.command["composio-claim"]`.
   - Optional `tool.execute.before/after` hooks only for package diagnostics; do not intercept unrelated tools in v1.
5. opencode exposes the tools alongside built-ins. The command appears as `/composio-claim` and sends a prompt that asks the current agent to call `composio_claim` with `$ARGUMENTS` as the email.

**Boundary:** registration is synchronous/low-side-effect. Do not hit Composio during startup except possibly to compute static metadata. First network access should happen on first tool use.

### 2. Credential resolution and first-use signup flow

```text
tool execute(args, context)
  → credentialResolver.resolve({ allowSignup })
     → if COMPOSIO_API_KEY exists: return env credential
     → else if ~/.composio/anonymous_user_data.json exists: return anonymous credential
     → else if tool allows first-use provisioning: signupService.signupAndPersist()
     → else return actionable missing-auth error
  → service call with Authorization/API key headers
```

Use this for every Composio-backed tool. The resolver must return a structured object such as `{ apiKey, source, anonymousUserId? }`, and log/return only `source`, not `apiKey`. `COMPOSIO_API_KEY` always wins over anonymous storage so CI and power users can override local state.

**Security-sensitive boundary:** only the credential resolver and low-level HTTP client should ever see raw secrets. Tool results, debug info, errors, logs, and command prompts must redact keys.

### 3. Meta-tool execution flow

```text
opencode tool: composio_search_tools / composio_multi_execute_tool / ...
  → validate args with Zod
  → safety policy classifies operation and appends warning metadata
  → resolve credential, signing up if necessary
  → get/create Composio tool-router session for opencode sessionID
  → POST /api/v3.1/tool_router/session/{session_id}/execute_meta
  → normalize response for agent consumption
```

Use a per-session tool-router cache keyed by opencode `context.sessionID` where available. If cache lookup fails, create a new session via `POST /api/v3.1/tool_router/session`. Do not persist session IDs to disk in v1; keeping them in memory avoids stale session and privacy problems.

### 4. Trigger authoring/lifecycle flow

```text
list trigger types
  → GET /api/v3.1/triggers_types with pagination/query filters

get trigger type schema
  → GET /api/v3.1/triggers_types/{slug}

create/upsert trigger
  → validate trigger name/slug/config payload
  → POST /api/v3.1/trigger_instances/{slug}/upsert

list triggers
  → GET /api/v3.1/trigger_instances/active

enable/disable trigger
  → PATCH /api/v3.1/trigger_instances/manage/{triggerId} with status enable/disable

delete trigger
  → DELETE /api/v3.1/trigger_instances/manage/{triggerId}
```

Trigger tools should return both concise status text and raw IDs/slugs needed for follow-up actions. Pagination should be explicit: default sane `limit`, return `cursor` if present, and accept `cursor` for continuation.

### 5. Automation handoff flow

`save_automation_definition` is local-only and should not call Composio. It writes the host/Pi-compatible automation definition after trigger creation or during authoring.

Path precedence:

1. Tool argument `filePath`.
2. Environment `PI_COMPOSIO_AUTOMATIONS_JSON`.
3. Default `~/.config/pi/composio-automations.json`.

The store should use a temp-file-and-rename write strategy, create the parent directory, preserve existing records, and validate that it is not writing outside an explicitly supplied absolute or expanded home path accidentally. If the file is malformed, do not overwrite blindly; write a `.corrupt.<timestamp>` backup or return a repair instruction.

## Safety / Permission Flow

opencode's permission system can require approval for tools by name, including custom and MCP-style wildcard names, but plugin tools should still carry their own safety posture. Recommended package behavior:

| Operation | Default plugin behavior | Recommended opencode permission |
|-----------|-------------------------|----------------------------------|
| Search tools, get schemas, list trigger types, get debug info | Safe read-only. Allow by default. | `composio_search_tools`, `composio_get_tool_schemas`, trigger read tools: `allow` |
| Signup and claim | Mutates identity/ownership. Require explicit email for claim and return clear confirmation text. | `composio_signup`, `composio_claim`: `ask` in shared environments |
| Manage connections | Can initiate auth or change account state. Tool description must warn. | `composio_manage_connections`: `ask` |
| Multi-execute | Can invoke arbitrary Composio app actions. Include target tool list in returned preamble/result. | `composio_multi_execute_tool`: `ask` |
| Remote bash / remote workbench | Open-world remote execution. Never hide behind generic names; descriptions must say remote execution. | `composio_remote_bash_tool`, `composio_remote_workbench`: `ask` or `deny` by default in examples |
| Trigger enable/disable/delete | Mutates long-running automations. Require `triggerId`; return exact target before/after. | `composio_enable_trigger`, `composio_disable_trigger`, `composio_delete_trigger`: `ask` |
| Save automation definition | Writes local file, possibly outside workspace. Validate path and report destination. | `save_automation_definition`: `ask` when writing outside project |

The package should publish a recommended config snippet rather than forcibly changing permissions in the plugin. Mutating user permissions at startup would be surprising and may weaken stricter project settings. Safety gates in code should focus on validation, redaction, warnings, and refusing ambiguous destructive calls.

## How opencode Command / Plugin / Tool Registration Should Work

### Plugin export

Use the official plugin shape: export an async function typed as `Plugin` from `@opencode-ai/plugin`. Return a hooks object, not a plain static object.

```typescript
import type { Plugin } from "@opencode-ai/plugin"
import { buildComposioTools } from "./tools"
import { registerCommands } from "./commands/register"
import { createServices } from "./services"

const plugin: Plugin = async (ctx, options?: PluginOptions) => {
  const services = createServices({ ctx, options })

  return {
    config(cfg) {
      registerCommands(cfg)
    },
    tool: buildComposioTools(services),
  }
}

export default plugin
```

### Tool registration

Use plugin-level `tool: { name: tool(...) }` for npm distribution. Avoid `.opencode/tools/*` as the primary package architecture because those file-discovered tools are better for local user customization and do not naturally package all runtime services as one npm plugin.

```typescript
import { tool } from "@opencode-ai/plugin"

export const composioDebugInfo = (services: Services) => tool({
  description: "Show redacted Composio/opencode integration diagnostics: credential source, registered tools, package version, and automation handoff path. Never returns API keys.",
  args: {},
  async execute(_args, context) {
    return services.debugInfo.render(context)
  },
})
```

Use lowercase snake_case opencode tool names even when they wrap uppercase Composio meta-tool slugs. This keeps opencode names readable while preserving upstream slugs inside service calls.

### Command registration

The `/composio-claim <email>` command should be a command template, not a separate command runner. The command template should instruct the current model to call the registered `composio_claim` tool with the email argument.

```typescript
export function registerCommands(cfg: { command?: Record<string, unknown> }) {
  cfg.command ??= {}
  cfg.command["composio-claim"] ??= {
    description: "Claim this anonymous Composio user into an organization account using an email address.",
    template: "Call the composio_claim tool with this email: $ARGUMENTS. Explain the result and any next steps.",
  }
}
```

Do not override an existing user-defined `composio-claim` command unless an explicit plugin option requests it.

## Patterns to Follow

### Pattern 1: Thin Adapter, Stable Core
**What:** Keep opencode-specific registration and context handling in `plugin.ts` and `tools/*`; keep auth, Composio HTTP, triggers, and handoff storage independent of opencode.  
**When:** Always. This package needs unit tests without launching opencode and may later expose the same core through another host.  
**Example:**

```typescript
async function executeTriggerUpsert(args: UpsertTriggerArgs, ctx: ToolContext) {
  await services.safety.assertAllowed("trigger.upsert", args)
  const credential = await services.credentials.resolve({ allowSignup: true })
  return services.triggers.upsert(credential, args)
}
```

### Pattern 2: Explicit Risk in Names and Descriptions
**What:** The opencode tool name and description should make risky operations obvious before permission prompts appear.  
**When:** Remote execution, connection management, multi-tool execution, trigger mutation, and file writes.  
**Example:** `composio_remote_bash_tool` description starts with "Run a command in Composio's remote environment..." not "Execute helper".

### Pattern 3: Redacted Debug Surface
**What:** `composio_debug_info` is the support boundary. It should report credential source, paths, package version, base URLs, session cache state, and registered tool names while redacting tokens.  
**When:** Every support issue and smoke test.  
**Example output fields:** `credentialSource: "env:COMPOSIO_API_KEY"`, `anonymousCredentialFileExists: true`, `automationPath: "~/.config/pi/composio-automations.json"`, `registeredTools: [...]`.

### Pattern 4: Atomic Compatibility File Writes
**What:** Treat `~/.config/pi/composio-automations.json` as an external contract. Validate, append/update, write to a temp file, then rename.  
**When:** Every `save_automation_definition` call.  
**Example:** write `composio-automations.json.tmp-<pid>` in the same directory, then rename so readers do not observe partial JSON.

## Suggested Build Order

1. **Package skeleton and opencode plugin smoke path**
   - Create TypeScript package, build/test/typecheck scripts, plugin export, local opencode fixture, and one `composio_debug_info` tool.
   - Why first: validates distribution and opencode registration before any Composio complexity.
2. **Service container, credential resolver, and redacted debug info**
   - Implement env/file credential precedence and anonymous credential file parsing without signup mutation first.
   - Why second: every remote tool depends on auth and safe diagnostics.
3. **Composio API client and tool-router session wrapper**
   - Implement base HTTP client, error normalization, session create/cache, and generic `executeMetaTool`.
   - Why third: all six meta tools share this path.
4. **Read-only meta tools**
   - Add `composio_search_tools` and `composio_get_tool_schemas` first.
   - Why fourth: proves remote API path with low operational risk.
5. **Signup and claim**
   - Add `composio_signup`, `composio_claim`, and `/composio-claim` command once debug/auth scaffolding exists.
   - Why fifth: resolves no-setup promise; needs extra verification against reference package/live behavior.
6. **Mutable/high-risk meta tools with safety classifications**
   - Add manage connections, multi-execute, remote bash, and remote workbench with explicit descriptions and recommended permissions.
   - Why sixth: depends on safety policy, API client, and credential maturity.
7. **Trigger type and trigger lifecycle tools**
   - Implement list/get trigger type, upsert/list active/enable/disable/delete trigger tools using v3.1 endpoints.
   - Why seventh: independently valuable, but mutation-heavy and benefits from prior safety/error patterns.
8. **Automation handoff store**
   - Add `save_automation_definition` with Pi-compatible path resolution and atomic writes.
   - Why eighth: local file contract should be built after trigger IDs/schema outputs are known.
9. **Integration tests and manual opencode smoke test**
   - Add mocked unit coverage first, then credential-gated live tests for tool search, trigger list, signup/claim if safely testable, and handoff write.
   - Why last: integration tests need stable tool names, schemas, and env conventions.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Per-App opencode Tool Generation
**What:** Generating one opencode tool for each Composio app/action.  
**Why bad:** Bloats the tool namespace, slows startup, complicates permissions, and violates v1 scope.  
**Instead:** Register fixed meta tools and let Composio search/schema/multi-execute route app-specific actions dynamically.

### Anti-Pattern 2: Network Calls During Plugin Initialization
**What:** Creating Composio sessions or signing up users during opencode startup.  
**Why bad:** Makes opencode startup flaky/offline-hostile and mutates identity before user intent.  
**Instead:** Lazy-create sessions and credentials on first relevant tool call.

### Anti-Pattern 3: Leaking Credentials Through Debug/Errors
**What:** Returning raw API keys, Authorization headers, anonymous credential contents, or unredacted HTTP errors to the agent.  
**Why bad:** Tool outputs enter model context and logs.  
**Instead:** Centralize redaction in HTTP error normalization and debug info.

### Anti-Pattern 4: Mutating User Permissions Automatically
**What:** Plugin startup rewrites `cfg.permission` to allow its tools.  
**Why bad:** Surprises users and can weaken project/global security policy.  
**Instead:** Publish a recommended config snippet and rely on opencode permission prompts plus package validation.

### Anti-Pattern 5: Overwriting the Pi Automation File on Parse Error
**What:** If `composio-automations.json` is invalid, replace it with a fresh array/object.  
**Why bad:** Destroys handoff data owned by another integration.  
**Instead:** fail with repair instructions or preserve a timestamped corrupt backup before writing.

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 1M users |
|---------|--------------|---------------|-------------|
| opencode startup | Static plugin registration; no remote calls. | Same; avoid generated tool explosion. | Same; package load remains bounded. |
| Tool-router sessions | In-memory session per opencode session. | Add conservative cache eviction and avoid disk persistence. | Consider upstream session lifecycle metrics/backoff if Composio rate limits emerge. |
| Composio API rate limits | Simple request timeout and clear errors. | Add retries for safe GET/session creation only; no retry for destructive operations unless idempotency is guaranteed. | Require explicit upstream rate-limit strategy and telemetry. |
| Trigger listing pagination | Default limit and cursor returned. | Cursor-based UI/agent continuation guidance. | Consider filters mandatory for large orgs. |
| Automation handoff file | Atomic local writes enough. | Add lock file if concurrent opencode sessions are common. | Move coordination to host app only if Pi format evolves; v1 should not invent new format. |
| Test matrix | Unit + one local smoke fixture. | CI across Node/Bun/opencode supported versions. | Compatibility contract tests against opencode plugin API releases. |

## Sources

- HIGH — opencode plugin docs, fetched 2026-05-15: plugins are JS/TS modules exporting plugin functions; npm plugins are configured in `plugin`, installed with Bun, cached under `~/.cache/opencode/node_modules/`, and plugin hooks can register custom tools with `tool: { ... }`. https://opencode.ai/docs/plugins
- HIGH — opencode custom tools docs, fetched 2026-05-15: custom tools use `@opencode-ai/plugin` `tool()` helper and Zod schemas; tools receive `agent`, `sessionID`, `messageID`, `directory`, and `worktree` context. https://opencode.ai/docs/custom-tools
- HIGH — opencode commands docs, fetched 2026-05-15: commands can be configured in `command` with required `template`, support `$ARGUMENTS`, and appear as `/name` in TUI. https://opencode.ai/docs/commands
- HIGH — opencode config schema, fetched 2026-05-15: `plugin` array supports strings and `[name, options]`; `command` entries require `template`; `permission` supports named tools and additional tool keys. https://opencode.ai/config.json
- HIGH — opencode tools/permissions docs, fetched 2026-05-15: tools are enabled by default and controlled through permissions; custom/MCP tools can be controlled by tool name/wildcards. https://opencode.ai/docs/tools
- HIGH — Composio OpenAPI, fetched 2026-05-15: v3.1 exposes `/api/v3.1/tool_router/session`, `/api/v3.1/tool_router/session/{session_id}/execute_meta`, trigger type endpoints, trigger instance upsert/list/manage endpoints, and API-key auth schemes. https://backend.composio.dev/api/v3.1/openapi.json
- MEDIUM — Project planning context in `.planning/PROJECT.md`, read 2026-05-15: defines reference behavior from `composio-x-pi`, required meta tools, credential precedence, signup/claim, handoff path, and out-of-scope per-app generation.
- LOW/MEDIUM — Signup endpoint behavior: `https://agents.composio.dev/api/signup` is in project requirements and returned 405 to GET during research, so endpoint exists but exact POST payload/response must be verified during implementation against `composio-x-pi` or live API.
