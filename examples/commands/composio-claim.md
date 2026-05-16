---
description: Claim the anonymous Composio organization for a human email
---

# /composio-claim <email>

Validate `$ARGUMENTS` as exactly one email address for the person who should take over the anonymous Composio organization.

Then call the `composio_claim` tool with:

```json
{ "email": "$ARGUMENTS" }
```

After the tool returns, summarize the claim status, the requested email, whether an invite is present, and the next steps from the tool output.

Never print API keys, agent keys, Authorization headers, raw anonymous credential JSON, or raw invite codes. If the tool says the anonymous identity is missing, tell the user to run `composio_signup` first and then retry `/composio-claim <email>`.
