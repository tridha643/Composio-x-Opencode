# composio-x-opencode

`composio-x-opencode` is an opencode plugin package that will expose Composio runtime, trigger-authoring, auth, diagnostics, and Pi-compatible automation handoff tools inside opencode.

Phase 1 registers the stable v1 tool namespace from local static source only. The placeholders do not contact Composio, read credentials, sign up users, or execute remote actions yet; later phases fill in behavior behind these fixed names.

## Stable v1 tool namespace

v1 uses static Composio meta, trigger, auth, debug, and handoff tools rather than generated per-app tools. This keeps opencode startup predictable and avoids registering thousands of app-specific Composio tools.

All public tools are lowercase and `composio_`-prefixed except the roadmap-locked `save_automation_definition` tool, which intentionally preserves the Pi-compatible automation handoff name.

The stable public v1 tool names are:

1. `composio_debug_info`
2. `composio_signup`
3. `composio_claim`
4. `composio_search_tools`
5. `composio_get_tool_schemas`
6. `composio_manage_connections`
7. `composio_multi_execute_tool`
8. `composio_remote_bash_tool`
9. `composio_remote_workbench`
10. `composio_list_trigger_types`
11. `composio_get_trigger_type_schema`
12. `composio_create_trigger`
13. `composio_list_triggers`
14. `composio_enable_trigger`
15. `composio_disable_trigger`
16. `composio_delete_trigger`
17. `save_automation_definition`

`save_automation_definition` is the only unprefixed public tool name in v1. Do not rename it; the name is part of the compatibility contract with the Pi automation handoff path.
