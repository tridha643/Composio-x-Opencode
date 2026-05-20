import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "es2022",
  outDir: "dist",
  dts: true,
  sourcemap: false,
  clean: true,
  splitting: false,
  bundle: true,
  external: ["@opencode-ai/plugin", "zod"],
})
