import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"

const COMMAND_PATHS = [".opencode/commands/composio-claim.md", "examples/commands/composio-claim.md"] as const
const SET_API_KEY_COMMAND_PATHS = [
  ".opencode/commands/composio-set-api-key.md",
  "examples/commands/composio-set-api-key.md",
] as const

describe("/composio-claim command templates", () => {
  test("route arguments to composio_claim and document secret-safe output", async () => {
    for (const path of COMMAND_PATHS) {
      const content = await readFile(path, "utf8")

      expect(content).toContain("description:")
      expect(content).toContain("/composio-claim <email>")
      expect(content).toContain("$ARGUMENTS")
      expect(content).toContain("composio_claim")
      expect(content).toMatch(/validate [`']?\$ARGUMENTS[`']?/i)
      expect(content).toMatch(/status/i)
      expect(content).toMatch(/next steps/i)
      expect(content).toMatch(/never print/i)
      expect(content).toMatch(/api keys/i)
      expect(content).toMatch(/agent keys/i)
      expect(content).toMatch(/Authorization headers/i)
      expect(content).toMatch(/raw anonymous credential JSON/i)
      expect(content).toMatch(/raw invite codes/i)
      expect(content).toContain("composio_signup")

      expect(content).not.toMatch(/automatic global config mutation/i)
      expect(content).not.toMatch(/mutate global/i)
      expect(content).not.toMatch(/write.*opencode config/i)
      expect(content).not.toMatch(/automatically register/i)
    }
  })
})

describe("/composio-set-api-key command templates", () => {
  test("store API keys through hidden local input without exposing secrets", async () => {
    for (const path of SET_API_KEY_COMMAND_PATHS) {
      const content = await readFile(path, "utf8")

      expect(content).toContain("description:")
      expect(content).toContain("/composio-set-api-key")
      expect(content).toContain("$ARGUMENTS")
      expect(content).toMatch(/Do not accept an API key/i)
      expect(content).toMatch(/slash-command arguments are visible/i)
      expect(content).toContain("composio_debug_info")
      expect(content).toContain("/bin/zsh -c")
      expect(content).not.toContain("/bin/zsh -lc")
      expect(content).toContain("/dev/tty")
      expect(content).toContain("stty -echo")
      expect(content).toContain("osascript")
      expect(content).toMatch(/hidden GUI prompt/i)
      expect(content).toContain("$HOME/.composio")
      expect(content).toContain("anonymous_user_data.json")
      expect(content).toContain("chmod 700")
      expect(content).toContain("chmodSync(file, 0o600)")
      expect(content).toMatch(/envKeyPrecedence/i)
      expect(content).toMatch(/COMPOSIO_API_KEY/i)
      expect(content).toMatch(/restart opencode/i)
      expect(content).toMatch(/never print/i)
      expect(content).toMatch(/api keys/i)
      expect(content).toMatch(/Authorization headers/i)
      expect(content).toMatch(/OAuth tokens/i)
      expect(content).toMatch(/raw credential JSON/i)
      expect(content).toMatch(/access tokens/i)
    }
  })
})
