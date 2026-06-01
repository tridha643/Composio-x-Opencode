---
description: Store a Composio API key locally without placing the secret in chat history
---

# /composio-set-api-key

Do not accept an API key in `$ARGUMENTS`. If `$ARGUMENTS` is not empty, refuse to store it, explain that slash-command arguments are visible in chat/history, and ask the user to retry with `/composio-set-api-key` and no arguments.

First call `composio_debug_info` to inspect the current auth source without contacting Composio.

Then run this local shell command to prompt for the key without echoing it and store it in the plugin's existing local credential file. It uses `/dev/tty` when available and falls back to a macOS hidden GUI prompt when opencode's shell runner has no interactive TTY:

```bash
/bin/zsh -c 'set -euo pipefail; umask 077; prompt_tty() { [ -t 0 ] || return 1; [ -r /dev/tty ] && [ -w /dev/tty ] || return 1; print -n "Composio API key: " 2>/dev/null > /dev/tty || return 1; stty -echo 2>/dev/null < /dev/tty || return 1; IFS= read -r key 2>/dev/null < /dev/tty || { stty echo 2>/dev/null < /dev/tty || true; return 1; }; stty echo 2>/dev/null < /dev/tty || true; print "" 2>/dev/null > /dev/tty || true; }; prompt_gui() { [ "$(uname -s)" = "Darwin" ] || return 1; command -v osascript >/dev/null 2>&1 || return 1; key=$(osascript -e '\''display dialog "Composio API key:" default answer "" with hidden answer buttons {"Store"} default button "Store"'\'' -e '\''text returned of result'\'' 2>/dev/null) || return 1; }; if ! prompt_tty; then prompt_gui || { print -u2 "No interactive terminal or macOS GUI prompt is available for hidden input. Retry from a local opencode terminal, or set COMPOSIO_API_KEY in the shell that launches opencode."; exit 2; }; fi; if [ -z "$key" ]; then print -u2 "No API key entered."; exit 1; fi; mkdir -p "$HOME/.composio"; chmod 700 "$HOME/.composio"; COMPOSIO_API_KEY_INPUT="$key" node -e '\''const fs=require("node:fs"); const os=require("node:os"); const path=require("node:path"); const file=path.join(os.homedir(), ".composio", "anonymous_user_data.json"); let data={}; try { data=JSON.parse(fs.readFileSync(file, "utf8")); } catch {} if (!data || typeof data !== "object" || Array.isArray(data)) data={}; data.status=data.status || "ready"; data.composio={...(data.composio && typeof data.composio === "object" && !Array.isArray(data.composio) ? data.composio : {}), api_key: process.env.COMPOSIO_API_KEY_INPUT}; fs.writeFileSync(file, JSON.stringify(data, null, 2)+"\n", {mode:0o600}); fs.chmodSync(file, 0o600);'\''; unset key COMPOSIO_API_KEY_INPUT; print "Stored Composio API key at $HOME/.composio/anonymous_user_data.json"'
```

After the shell command completes, call `composio_debug_info` again.

If the debug output shows `auth.source` as `env` or `envKeyPrecedence` as `true`, explain that the key was stored but opencode is still using the already-set `COMPOSIO_API_KEY` from its current environment. Tell the user to restart opencode with that environment variable fixed or unset before the stored key can take effect.

If the debug output shows the anonymous credential file is present and there is no environment-key precedence, summarize that the key is stored and ready for Composio tools.

Never print API keys, agent keys, Authorization headers, OAuth tokens, raw credential JSON, raw invite codes, email access tokens, or full upstream request headers.
