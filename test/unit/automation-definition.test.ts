import { describe, expect, test } from "bun:test"
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

import { UserFacingError } from "../../src/auth/errors"
import {
  AUTOMATIONS_FILE_ENV,
  defaultAutomationsFilePath,
  resolveAutomationDefinitionFilePath,
  saveAutomationDefinition,
} from "../../src/handoff/automation-definition"

const FIXED_NOW = new Date("2026-05-20T12:00:00.000Z")

async function withTempDir<T>(callback: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "composio-x-opencode-automation-"))
  try {
    return await callback(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

describe("Pi-compatible automation handoff", () => {
  test("resolves filePath, env, and default handoff paths in precedence order", () => {
    const home = "/tmp/home"
    const cwd = "/tmp/workspace"
    const envPath = "env/automations.json"

    expect(resolveAutomationDefinitionFilePath({}, { home, cwd, env: {} })).toBe(defaultAutomationsFilePath(home))
    expect(resolveAutomationDefinitionFilePath({}, { home, cwd, env: { [AUTOMATIONS_FILE_ENV]: envPath } })).toBe(
      resolve(cwd, envPath),
    )
    expect(
      resolveAutomationDefinitionFilePath(
        { filePath: "~/specific/automations.json" },
        { home, cwd, env: { [AUTOMATIONS_FILE_ENV]: envPath } },
      ),
    ).toBe(join(home, "specific", "automations.json"))
  })

  test("creates a JSON array handoff file and reports the write", async () => {
    await withTempDir(async (dir) => {
      const filePath = join(dir, "nested", "automations.json")

      const result = await saveAutomationDefinition(
        {
          name: "Linear triage",
          triggerId: "trg_123",
          triggerSlug: "LINEAR_ISSUE_CREATED",
          instructions: "Create a follow-up task.",
          enabled: true,
          metadata: { owner: "support" },
          filePath,
        },
        { now: () => FIXED_NOW },
      )

      expect(result).toEqual({
        ok: true,
        filePath,
        operation: "inserted",
        automation: {
          name: "Linear triage",
          triggerId: "trg_123",
          triggerSlug: "LINEAR_ISSUE_CREATED",
          instructions: "Create a follow-up task.",
          enabled: true,
          metadata: { owner: "support" },
          updatedAt: FIXED_NOW.toISOString(),
        },
      })

      const saved = JSON.parse(await readFile(filePath, "utf8"))
      expect(saved).toEqual([result.automation])
    })
  })

  test("upserts by triggerId while preserving unrelated records and unknown fields", async () => {
    await withTempDir(async (dir) => {
      const filePath = join(dir, "automations.json")
      await writeFile(
        filePath,
        `${JSON.stringify(
          [
            {
              name: "Old name",
              triggerId: "trg_123",
              triggerSlug: "LINEAR_ISSUE_CREATED",
              instructions: "Old instructions.",
              enabled: false,
              metadata: { owner: "existing" },
              hostOnly: { keep: true },
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
            {
              name: "Other automation",
              triggerId: "trg_999",
              custom: "survives",
            },
          ],
          null,
          2,
        )}\n`,
        "utf8",
      )

      const result = await saveAutomationDefinition(
        {
          name: "New name",
          triggerId: "trg_123",
          triggerSlug: "LINEAR_ISSUE_CREATED",
          instructions: "New instructions.",
          filePath,
        },
        { now: () => FIXED_NOW },
      )

      expect(result.operation).toBe("updated")
      const saved = JSON.parse(await readFile(filePath, "utf8")) as Array<Record<string, unknown>>
      expect(saved).toHaveLength(2)
      expect(saved[0]).toEqual({
        name: "New name",
        triggerId: "trg_123",
        triggerSlug: "LINEAR_ISSUE_CREATED",
        instructions: "New instructions.",
        enabled: false,
        metadata: { owner: "existing" },
        hostOnly: { keep: true },
        updatedAt: FIXED_NOW.toISOString(),
      })
      expect(saved[1]).toEqual({
        name: "Other automation",
        triggerId: "trg_999",
        custom: "survives",
      })
    })
  })

  test("rejects invalid existing JSON without corrupting the file", async () => {
    await withTempDir(async (dir) => {
      const filePath = join(dir, "automations.json")
      await writeFile(filePath, "not json", "utf8")

      await expect(
        saveAutomationDefinition({
          name: "Broken",
          triggerId: "trg_broken",
          triggerSlug: "BROKEN_EVENT",
          instructions: "Should not write.",
          filePath,
        }),
      ).rejects.toBeInstanceOf(UserFacingError)

      expect(await readFile(filePath, "utf8")).toBe("not json")
    })
  })

  test("keeps the original file when the atomic rename fails", async () => {
    await withTempDir(async (dir) => {
      const filePath = join(dir, "automations.json")
      const original = `${JSON.stringify([{ triggerId: "trg_original", name: "Original" }], null, 2)}\n`
      await writeFile(filePath, original, "utf8")

      await expect(
        saveAutomationDefinition(
          {
            name: "New automation",
            triggerId: "trg_new",
            triggerSlug: "NEW_EVENT",
            instructions: "Should not replace original.",
            filePath,
          },
          {
            renameImpl: async () => {
              throw new Error("rename failed")
            },
          },
        ),
      ).rejects.toThrow("rename failed")

      expect(await readFile(filePath, "utf8")).toBe(original)
      expect((await readdir(dir)).filter((entry) => entry.includes(".tmp"))).toHaveLength(0)
    })
  })
})
