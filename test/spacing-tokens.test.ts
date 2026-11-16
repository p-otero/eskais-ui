import { readFileSync } from "node:fs"
import { expect, test } from "vitest"

import { cn } from "@/lib/utils"

const theme = readFileSync("registry/styles/theme.css", "utf8")

test("every spacing role is a Tailwind spacing value or a utility in the theme", () => {
  for (const role of [
    "inline",
    "items",
    "group",
    "section",
    "inset-surface",
    "surface",
    "control-x",
    "control-inset",
  ]) {
    expect(theme).toContain(`--spacing-${role}:`)
  }
  for (const utility of ["px-inset-chip", "py-inset-chip", "px-inset-item", "py-inset-item"]) {
    expect(theme).toContain(`@utility ${utility} {`)
  }
})

test("a consumer's spacing class replaces the role token it overrides", () => {
  expect(cn("flex gap-items", "gap-4")).toBe("flex gap-4")
  expect(cn("px-inset-chip py-inset-chip", "px-3")).toBe("py-inset-chip px-3")
  expect(cn("p-inset-surface", "p-2")).toBe("p-2")
  expect(cn("md:gap-inline", "md:gap-2")).toBe("md:gap-2")
  expect(cn("h-control px-control-x", "h-10 px-4")).toBe("h-10 px-4")
})
