import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"

const COMMAND_PATHS = [".opencode/commands/composio-claim.md", "examples/commands/composio-claim.md"] as const

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
