import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { categories } from "../apps/site/src/content/categories"
import { itemNotes } from "../apps/site/src/content/items"
import { guides } from "../apps/site/src/guides/meta"
import { extractApi } from "../apps/site/src/lib/extract-api"
import { componentItems, guideItems, items } from "../apps/site/src/registry"
import { componentPath, routes } from "../apps/site/src/routes"

const site = join(import.meta.dirname, "..", "apps", "site", "src")
const categorized: string[] = categories.flatMap((category) => [...category.items])

describe("site pages", () => {
  it("gives every registry item a component page or a Getting started guide", () => {
    const missing = items
      .map((item) => item.name)
      .filter((name) => !guideItems.includes(name) && !routes.some((route) => route.path === componentPath(name)))
    expect(missing).toEqual([])
  })

  it("has an example and a sidebar category for every component page", () => {
    const withoutExample = componentItems.filter((item) => !existsSync(join(site, "examples", `${item.name}.tsx`)))
    const uncategorized = componentItems.filter((item) => !categorized.includes(item.name))
    expect(withoutExample.map((item) => item.name)).toEqual([])
    expect(uncategorized.map((item) => item.name)).toEqual([])
  })

  it("lists only real items in categories and notes", () => {
    const names = new Set(items.map((item) => item.name))
    expect(categorized.filter((name) => !names.has(name))).toEqual([])
    expect(Object.keys(itemNotes).filter((name) => !names.has(name))).toEqual([])
    for (const notes of Object.values(itemNotes)) {
      expect((notes.related ?? []).filter((name) => !names.has(name))).toEqual([])
    }
  })

  it("covers each item without a page in a guide", () => {
    const covered = guides.flatMap((guide) => guide.covers ?? [])
    expect(guideItems.filter((name) => !covered.includes(name))).toEqual([])
    for (const guide of guides) expect(existsSync(join(site, "guides", `${guide.slug}.tsx`))).toBe(true)
  })

  it("has unique route paths", () => {
    const paths = routes.map((route) => route.path)
    expect(new Set(paths).size).toBe(paths.length)
  })
})

const read = (file: string) => readFileSync(join(import.meta.dirname, "..", "registry", "ui", file), "utf8")

describe("extractApi", () => {
  it("reads a component's own props, cva variants and defaults", () => {
    const button = extractApi(read("button.tsx")).components.find((component) => component.name === "Button")
    const variant = button?.props.find((prop) => prop.name === "variant")
    expect(variant?.type).toContain('"destructive"')
    expect(variant?.defaultValue).toBe('"default"')
    expect(button?.props.map((prop) => prop.name)).toContain("loading")
    expect(button?.inherits[0]?.label).toBe("UI SDK Button")
  })

  it("reads destructured defaults and required props", () => {
    const sidebar = extractApi(read("sidebar.tsx")).components.find((component) => component.name === "Sidebar")
    const label = sidebar?.props.find((prop) => prop.name === "label")
    expect(label?.optional).toBe(false)
    expect(sidebar?.props.find((prop) => prop.name === "collapsible")?.defaultValue).toBe("true")
  })

  it("lists exports and types", () => {
    const api = extractApi(read("floating.tsx"))
    expect(api.exports).toEqual(["Floating", "FloatingContent"])
    expect(api.types).toContain("FloatingProps")
  })
})
