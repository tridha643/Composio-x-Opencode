---
phase: 02-credentials-signup-claim-redacted-debug
plan: "03"
type: execute
wave: 3
depends_on:
  - 02-credentials-signup-claim-redacted-debug-01
  - 02-credentials-signup-claim-redacted-debug-02
files_modified:
  - src/auth/claim-flow.ts
  - src/tools/auth.ts
  - .opencode/commands/composio-claim.md
  - examples/commands/composio-claim.md
  - test/unit/claim-flow.test.ts
  - test/unit/auth-tools.test.ts
  - test/unit/composio-claim-command.test.ts
autonomous: true
must_haves:
  truths:
    - "User can request anonymous org handoff by calling composio_claim with an email"
    - "User has a verifyable /composio-claim <email> slash-command path that routes to composio_claim"
    - "Claim responses provide actionable invite status and next steps without exposing agent keys or API keys"
    - "Claim requires an anonymous agent identity and guides the user to run composio_signup if one is missing"
  artifacts:
    - path: "src/auth/claim-flow.ts"
      provides: "Anonymous identity claim/handoff orchestration"
      exports: ["claimAnonymousIdentity"]
    - path: "src/tools/auth.ts"
      provides: "opencode tool factory for composio_claim"
      exports: ["createClaimTool"]
    - path: ".opencode/commands/composio-claim.md"
      provides: "Local opencode slash command path for /composio-claim <email>"
    - path: "examples/commands/composio-claim.md"
      provides: "Copyable command template for package users if plugin-level command registration is unsupported"
  key_links:
    - from: "src/auth/claim-flow.ts"
      to: "src/auth/anonymous-user-data.ts"
      via: "load agent_key from anonymous credentials before claim"
      pattern: "readAnonymousUserData"
    - from: "src/auth/claim-flow.ts"
      to: "https://agents.composio.dev/api/claim"
      via: "POST claim with Authorization Bearer agent_key"
      pattern: "/api/claim"
    - from: ".opencode/commands/composio-claim.md"
      to: "composio_claim"
      via: "command prompt instructs agent to call tool with $ARGUMENTS email"
      pattern: "composio_claim[\\s\\S]*\\$ARGUMENTS"
---

<objective>
Implement anonymous organization claim/handoff through both the `composio_claim` tool factory and a verifyable `/composio-claim <email>` opencode command template. This plan runs after Plan 02 because it extends `src/tools/auth.ts` and `test/unit/auth-tools.test.ts` created for signup.

Purpose: Users need an explicit human-facing path to take over the anonymous Composio org without the plugin mutating global opencode config or leaking credentials.
Output: Claim service, claim tool factory, local/copyable command files, and tests for email validation, missing-identity guidance, redaction, and command content.
</objective>

<execution_context>
@/Users/tri/.config/opencode/get-shit-done/workflows/execute-plan.md
@/Users/tri/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/02-credentials-signup-claim-redacted-debug/02-credentials-signup-claim-redacted-debug-RESEARCH.md
@.planning/phases/02-credentials-signup-claim-redacted-debug/02-credentials-signup-claim-redacted-debug-01-SUMMARY.md
@.planning/phases/02-credentials-signup-claim-redacted-debug/02-credentials-signup-claim-redacted-debug-02-SUMMARY.md
@src/auth/anonymous-user-data.ts
@src/auth/redact.ts
@src/auth/errors.ts
@src/plugin/manifest.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add claim flow service with safe status output</name>
  <files>src/auth/claim-flow.ts, test/unit/claim-flow.test.ts</files>
  <action>Create `claimAnonymousIdentity({ email, home?, fetchImpl?, baseUrl? })`. Validate email with a pragmatic single-address check before network. Load anonymous credentials from `~/.composio/anonymous_user_data.json`; if missing `agent_key`, throw `UserFacingError` with code like `MISSING_ANONYMOUS_IDENTITY` and message telling the agent to call `composio_signup` first. POST `${baseUrl}/api/claim` with `Authorization: Bearer <agent_key>`, JSON `{ email }`, and no env API key. Parse tolerant response shapes from research: top-level or nested `data`, `invite_code` or `inviteCode`, status casing differences. Return safe summary `{ ok: true, status, email, orgId, inviteCodePresent, nextSteps }` and never raw invite_code unless you decide invite_code is non-secret; safest is `inviteCodePresent: true`. Tests must cover validation, missing identity, successful invited response, nested/camelCase response, HTTP error redaction, and Authorization not appearing in error payloads.</action>
  <verify>bun test test/unit/claim-flow.test.ts</verify>
  <done>Claim flow sends the official request only with anonymous agent authorization, handles documented/tolerant responses, and gives safe actionable next steps.</done>
</task>

<task type="auto">
  <name>Task 2: Add composio_claim tool factory</name>
  <files>src/tools/auth.ts, test/unit/auth-tools.test.ts</files>
  <action>Extend `src/tools/auth.ts` with `createClaimTool()` using `tool()` and a schema requiring `{ email: string }`. The execute handler must call `claimAnonymousIdentity`, return ToolResult-compatible JSON string output and metadata with only safe fields, and convert all errors through `toToolErrorPayload`. Update or add auth tool tests so both `createSignupTool` from Plan 02 and `createClaimTool` can coexist in the same file; avoid reintroducing placeholders here. Tests must execute claim with mocked fetch/home and assert missing identity guidance mentions `composio_signup`, successful status mentions the email and next steps, and serialized output contains no `agent_key`, `api_key`, `user_api_key`, `Authorization`, or sentinel secret values.</action>
  <verify>bun test test/unit/auth-tools.test.ts && bun run typecheck</verify>
  <done>`composio_claim` has a concrete safe tool implementation ready for registry wiring with required email validation and signup-first guidance.</done>
</task>

<task type="auto">
  <name>Task 3: Add verifyable slash-command path for /composio-claim</name>
  <files>.opencode/commands/composio-claim.md, examples/commands/composio-claim.md, test/unit/composio-claim-command.test.ts</files>
  <action>Create `.opencode/commands/composio-claim.md` so the repository/local checkout exposes a human-facing `/composio-claim <email>` command path. Also create `examples/commands/composio-claim.md` as a copyable template for users because research says npm package-level automatic command registration is uncertain. The command markdown must include frontmatter description and prompt text: validate `$ARGUMENTS` as the email, call the `composio_claim` tool with that email, summarize returned status/next steps, and never print API keys, agent keys, Authorization headers, or raw anonymous credential JSON. Add a unit test that reads both markdown files, verifies `$ARGUMENTS`, `composio_claim`, `/composio-claim`, and secret-safety instructions are present, and verifies the files do not include placeholder unsupported claims like automatic global config mutation.</action>
  <verify>bun test test/unit/composio-claim-command.test.ts</verify>
  <done>AUTH-07 is satisfied by a local opencode slash-command path and package-user command template without pretending unsupported package-level registration exists.</done>
</task>

</tasks>

<verification>
Run `bun test test/unit/claim-flow.test.ts test/unit/auth-tools.test.ts test/unit/composio-claim-command.test.ts && bun run typecheck`. Confirm command files are markdown-only templates and do not mutate user config.
</verification>

<success_criteria>
- `composio_claim` requests handoff to a provided email using only the anonymous `agent_key`.
- Missing anonymous identity tells users to run `composio_signup` first.
- `/composio-claim <email>` exists as a verifyable opencode command file in the repo and a copyable example.
- Claim outputs are actionable and secret-free.
</success_criteria>

<output>
After completion, create `.planning/phases/02-credentials-signup-claim-redacted-debug/02-credentials-signup-claim-redacted-debug-03-SUMMARY.md`
</output>
