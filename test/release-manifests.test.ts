/**
 * The npm package and the Claude Code plugin are one release: same version,
 * and the plugin runs exactly the server it was published with.
 */
import { describe, expect, test } from "bun:test"
import path from "node:path"

import { z } from "zod"

const root = path.resolve(import.meta.dir, "..")

const readJson = async <T extends z.ZodType>(
  rel: string,
  schema: T
): Promise<z.output<T>> =>
  schema.parse(await Bun.file(path.join(root, rel)).json())

const packageSchema = z.object({
  bin: z.record(z.string(), z.string()),
  files: z.array(z.string()),
  name: z.string(),
  private: z.boolean(),
  version: z.string(),
})

const pluginSchema = z.object({ name: z.string(), version: z.string() })

const mcpSchema = z.object({
  mcpServers: z.record(
    z.string(),
    z.object({ args: z.array(z.string()), command: z.string() })
  ),
})

const marketplaceSchema = z.object({
  plugins: z.array(
    z.object({
      name: z.string(),
      source: z.string(),
      version: z.string().optional(),
    })
  ),
})

describe("npm package", () => {
  test("is publishable under the free name with the built UI inside", async () => {
    const pkg = await readJson("package.json", packageSchema)
    expect(pkg.name).toBe("bbq-mcp")
    expect(pkg.private).toBe(false)
    expect(pkg.bin).toEqual({ "bbq-mcp": "src/mcp.ts" })
    expect(pkg.files).toContain("src")
    expect(pkg.files).toContain("ui/dist")
    expect(pkg.files).toContain("skills")
  })
})

describe("Claude Code plugin", () => {
  test("carries the package version and pins the server to it", async () => {
    const pkg = await readJson("package.json", packageSchema)
    const plugin = await readJson(".claude-plugin/plugin.json", pluginSchema)
    expect(plugin.name).toBe("bbq-mcp")
    expect(plugin.version).toBe(pkg.version)

    const mcp = await readJson(".mcp.json", mcpSchema)
    const server = mcp.mcpServers["bbq-mcp"]
    expect(server?.command).toBe("bunx")
    expect(server?.args).toEqual([`bbq-mcp@${pkg.version}`])
  })

  test("is listed by the marketplace hosted in this repo", async () => {
    const pkg = await readJson("package.json", packageSchema)
    const marketplace = await readJson(
      ".claude-plugin/marketplace.json",
      marketplaceSchema
    )
    const entry = marketplace.plugins.find((p) => p.name === "bbq-mcp")
    expect(entry?.source).toBe("./")
    expect(entry?.version).toBe(pkg.version)
  })
})
