# Phase 6 Summary: User Documentation & Permission Guidance

**Completed:** 2026-05-20  
**Status:** Complete  
**Requirements satisfied:** DOCS-01, DOCS-02, DOCS-03, DOCS-04, DOCS-05

## Delivered

- Replaced the stale Phase 1 README placeholder language with current user-facing documentation for implemented Phase 2-5 behavior.
- Documented npm and local checkout opencode plugin configuration, while keeping npm publish readiness explicitly owned by Phase 8.
- Documented the `/composio-claim <email>` command path through opencode command config and repository command templates.
- Documented credential precedence: `COMPOSIO_API_KEY`, then `~/.composio/anonymous_user_data.json`, then `composio_signup` guidance.
- Added a canonical registered-tool table with category, risk classification, and purpose for every public v1 tool.
- Added opencode `permission` snippets for risky auth, mutation, remote-code, trigger lifecycle, delete, and local-write tools.
- Documented schema-first workflows for Composio meta-tool execution and trigger authoring.
- Documented Pi-compatible `save_automation_definition` handoff path precedence, JSON array behavior, upsert semantics, and record shape.
- Documented local verification commands, opt-in live signup verification, relevant environment variables, and manual trigger cleanup guidance.
- Added an explicit out-of-scope section covering per-app generation, hosted automation runtime, UI, automatic permission mutation, npm release validation, live smoke validation, and advanced version-management UI.

## Verification

- README tool names checked against `src/plugin/manifest.ts`.
- README permission snippet uses current opencode `permission` config shape, not deprecated `tools` config.
- README no longer claims runtime tools are placeholders.

## Notes For Phase 7/8

- Phase 7 should validate custom plugin tool permissions in a real opencode session to confirm prompts target the documented custom tool names.
- Phase 7 should add live-safe integration and manual smoke coverage for debug, signup, safe meta-tool calls, trigger schema/listing, handoff save, and cleanup.
- Phase 8 should validate the npm tarball and update install wording if published package behavior differs from the documented plugin config shape.
