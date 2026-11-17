import { describe, expect, test } from "vitest"

import {
  formatProblems,
  importRule,
  pageProblems,
  reactDevBanner,
  sourceProblems,
  viewportHeightUnit,
} from "../src/checks"

const allowed = importRule(["@/components/", "@/lib/"], new Set(["react", "lucide-react"]))

describe("pageProblems", () => {
  test("a self-contained page has none", () => {
    const page = [
      "<!doctype html><html><head>",
      '<style>@font-face{src:url("data:font/woff2;base64,AAAA")}body{background:var(--background)}</style>',
      '</head><body><div id="root"></div><script type="module">console.log("</script")</script></body></html>',
    ].join("")
    expect(pageProblems(page)).toEqual([])
  })

  test("an unreplaced template placeholder is a problem", () => {
    expect(pageProblems('<html data-mockup-attributes><body><div id="root"></div></body></html>')).toEqual([
      "still has a template placeholder",
    ])
  })

  test("names every reference that leaves the file", () => {
    const page = [
      '<script src="main.js"></script>',
      '<link rel="stylesheet" href="a.css">',
      '<img src="./logo.png">',
      "<style>@import './other.css'; body { background: url(./bg.png) }</style>",
      '<div class="h-screen"></div>',
    ].join("")
    expect(pageProblems(page)).toEqual([
      "still loads an external script",
      "still loads an external stylesheet",
      "still loads an external image",
      "still imports a stylesheet",
      "still loads an asset that is not inlined",
      "uses a viewport height unit: h-screen",
    ])
  })

  test("viewportHeightUnit and reactDevBanner read the first match", () => {
    expect(viewportHeightUnit('<div class="min-h-dvh"></div>')).toBe("min-h-dvh")
    expect(viewportHeightUnit('<div style="height: 80vh"></div>')).toBe("80vh")
    expect(viewportHeightUnit('<div class="h-full"></div>')).toBeUndefined()
    expect(reactDevBanner('console.log("Download the React DevTools for a better development experience")')).toMatch(
      /^Download the React DevTools/,
    )
    expect(reactDevBanner("const mode = 'production'")).toBeUndefined()
  })
})

describe("sourceProblems", () => {
  test("reports the line and column of every rule", () => {
    const source = [
      'import { Button } from "@/components/ui/button"',
      'import { ReactNode } from "react"',
      'import { Nope } from "left-pad"',
      "",
      "export default function Screen() {",
      '  void fetch("/api")',
      "  return <button>Save</button>",
      "}",
    ].join("\n")
    expect(sourceProblems("screen.tsx", source, allowed).map((problem) => formatProblems([problem], 5)[0])).toEqual([
      'screen.tsx:3:1 import-specifier "left-pad" is not the project\'s: import through an alias, a relative path or a dependency',
      "screen.tsx:6:8 no-network fetch( calls the network; a mockup is one offline file",
      "screen.tsx:7:10 bare-control a bare <button> is invisible to agents and unstyled; use the project's own control part",
    ])
  })

  test("relative imports, aliases and dependencies need no problem", () => {
    const source = [
      'import { useState } from "react"',
      'import { ChevronDownIcon } from "lucide-react"',
      'import { Badge } from "@/components/ui/badge"',
      'import { cn } from "@/lib/utils"',
      'import { regions } from "./fixtures"',
    ].join("\n")
    expect(sourceProblems("screen.tsx", source, allowed)).toEqual([])
  })

  test("finds the other network calls and bare controls", () => {
    const source = [
      "const socket = new WebSocket(url)",
      "const request = new XMLHttpRequest()",
      "<input />",
      "<textarea />",
    ].join("\n")
    expect(sourceProblems("screen.tsx", source, allowed).map((problem) => problem.rule)).toEqual([
      "no-network",
      "no-network",
      "bare-control",
      "bare-control",
    ])
  })
})

describe("formatProblems", () => {
  const problems = Array.from({ length: 3 }, (_value, index) => ({
    file: "screen.tsx",
    line: index + 1,
    column: 1,
    rule: "no-network",
    message: "fetch",
  }))

  test("caps the list and says how many are hidden", () => {
    expect(formatProblems(problems, 2)).toEqual([
      "screen.tsx:1:1 no-network fetch",
      "screen.tsx:2:1 no-network fetch",
      "… 1 more problems (raise --max to see them)",
    ])
  })

  test("prints every problem under the cap", () => {
    expect(formatProblems(problems, 20)).toHaveLength(3)
  })
})
