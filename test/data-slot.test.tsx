import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"

import { AttachmentStrip, type Attachment } from "@/components/ui/attachments"
import { Button } from "@/components/ui/button"
import { CodeTabs } from "@/components/ui/code-tabs"
import { FilterBar } from "@/components/ui/filter-bar"
import { List, ListGroup, ListItem } from "@/components/ui/list-item"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

const uiDir = join(import.meta.dirname, "..", "registry", "ui")

test("a ListItem's row button keeps the registry slot", () => {
  render(
    <List aria-label="x">
      <ListItem id="a" title="A" onSelect={() => {}} />
    </List>,
  )
  expect(screen.getByRole("button", { name: "A" }).getAttribute("data-slot")).toBe("list-item-primary")
})

test("an option row and its group in a selectable List keep their slots", () => {
  const { container } = render(
    <List aria-label="x" defaultValue="a">
      <ListGroup label="Group">
        <ListItem id="a" title="A" />
      </ListGroup>
    </List>,
  )
  expect(screen.getByRole("option", { name: "A" }).getAttribute("data-slot")).toBe("list-item")
  expect(container.querySelector("[data-slot=list-group]")?.getAttribute("role")).toBe("group")
})

test("a Button part sets its slot through render and still hides the idle spinner; a trigger keeps button", () => {
  render(
    <>
      <Button render={(part) => <button {...part} data-slot="save-action" />}>Save</Button>
      <Tooltip>
        <TooltipTrigger render={<Button variant="outline" />}>Copy</TooltipTrigger>
        <TooltipContent>Copies it</TooltipContent>
      </Tooltip>
    </>,
  )
  const save = screen.getByRole("button", { name: "Save" })
  expect(save.getAttribute("data-slot")).toBe("save-action")
  expect(save.getAttribute("type")).toBe("button")
  expect(save.className).toContain("not-data-pending:[&>[data-show=pending]]:hidden")
  expect(screen.getByRole("button", { name: "Copy" }).getAttribute("data-slot")).toBe("button")
})

test("composed parts built on UI SDK buttons keep their slots", () => {
  const files: Attachment[] = [
    { id: "1", kind: "image", name: "a.png", src: "/a.png", alt: "A" },
    { id: "2", kind: "image", name: "b.png", src: "/b.png", alt: "B" },
    { id: "3", kind: "image", name: "c.png", src: "/c.png", alt: "C" },
  ]
  const { container } = render(
    <>
      <AttachmentStrip aria-label="Attachments" attachments={files} max={1} onOpen={() => {}} />
      <FilterBar label="Filters" isFiltered onReset={() => {}} resetLabel="Reset" />
      <CodeTabs aria-label="Files" files={[{ title: "a.ts", code: "1", language: "ts" }]} />
    </>,
  )
  expect(container.querySelectorAll("button[data-slot=attachment-thumb]")).toHaveLength(1)
  expect(container.querySelector("button[data-slot=attachment-more]")).not.toBeNull()
  expect(screen.getByRole("button", { name: "Reset" }).getAttribute("data-slot")).toBe("filter-bar-reset")
  expect(container.querySelector("[data-slot=code-tabs]")).not.toBeNull()
})

function uiSdkParts(source: string) {
  const names: string[] = []
  const from = /import\s*\{([^}]*)\}\s*from\s*"(?:@ui-sdk\/react\/[\w-]+|@\/components\/ui\/button)"/g
  for (const match of source.matchAll(from)) {
    for (const specifier of (match[1] ?? "").split(",")) {
      const name = specifier
        .replace(/^\s*type\s+/, "")
        .split(/\s+as\s+/)
        .pop()
        ?.trim()
      if (name && /^[A-Z]/.test(name)) names.push(name)
    }
  }
  return names
}

function openingTag(source: string, start: number) {
  let depth = 0
  let quote: string | null = null
  for (let index = start; index < source.length; index++) {
    const char = source[index]
    if (quote) {
      if (char === quote) quote = null
    } else if (char === "/" && source[index + 1] === "/") {
      index = source.indexOf("\n", index)
    } else if (char === '"' || char === "'" || char === "`") quote = char
    else if (char === "{") depth++
    else if (char === "}") depth--
    else if (char === ">" && depth === 0) return source.slice(start, index)
  }
  return source.slice(start)
}

function topLevelAttributes(tag: string) {
  let depth = 0
  let text = ""
  for (const char of tag) {
    if (char === "{") depth++
    if (depth === 0) text += char
    if (char === "}") depth--
  }
  return text
}

test("no registry file passes data-slot as a prop to a UI SDK part", () => {
  const offenders: string[] = []
  for (const file of readdirSync(uiDir).filter((name) => name.endsWith(".tsx"))) {
    const source = readFileSync(join(uiDir, file), "utf8")
    for (const name of uiSdkParts(source)) {
      for (const match of source.matchAll(new RegExp(`<${name}\\b`, "g"))) {
        if (/\sdata-slot=/.test(topLevelAttributes(openingTag(source, match.index))))
          offenders.push(`${file}: <${name}>`)
      }
    }
  }
  expect(offenders).toEqual([])
})
