import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { expect, test } from "vitest"

// A component that scrolls its own content does it in a ScrollArea (`scroll-area.tsx`), whose viewport sets its own
// overflow. These are the elements that still scroll natively, each with why, and how many of them each file has.
const allowed: Record<string, { count: number; reason: string }> = {
  "commit-branch-select.tsx": {
    count: 1,
    reason: "the branch list inside a Select popup, which scrolls natively like every floating list",
  },
  "dialog.tsx": {
    count: 1,
    reason: "the dialog element's fallback for content without a DialogBody, which is the scroll area",
  },
  "document-workspace-center.tsx": {
    count: 1,
    reason:
      "the page-level document, which hosts the editor: a viewport re-reads every focusable element below it on each tabindex change and each removal, which CodeMirror makes as you type",
  },
  "drawer.tsx": {
    count: 1,
    reason: "the drawer element's fallback for content that has no scrolling body of its own, as in dialog.tsx",
  },
  "dropdown-menu.tsx": {
    count: 1,
    reason:
      "a floating menu scrolls natively when it outgrows --available-height: menus take no name, so its scroll area couldn't take one for agents",
  },
  "markdown-editor-menus.tsx": { count: 1, reason: "the slash and wikilink menus, floating like dropdown-menu.tsx" },
  "markdown-editor-portals.tsx": {
    count: 1,
    reason: "a table widget inside the editor's text, where a focusable viewport would add a tab stop",
  },
  "markdown-editor.tsx": { count: 1, reason: "the editor's own scroller, which CodeMirror measures and follows" },
  "navigation-menu.tsx": { count: 1, reason: "a floating panel, like dropdown-menu.tsx" },
  "resizable.tsx": {
    count: 1,
    reason:
      "a layout fallback: panels put their own scroll area inside (MasterDetail, DocumentWorkspace), and one per panel would nest a second viewport around theirs",
  },
  "select.tsx": { count: 1, reason: "the floating list of Select, Combobox and Autocomplete, like dropdown-menu.tsx" },
  "shell.tsx": {
    count: 1,
    reason:
      "the page-level main column: its viewport would re-read every focusable element on the page at each tabindex change, so it scrolls natively like the window",
  },
  "sidebar.tsx": { count: 1, reason: "the sidebar's own scroll, converted with the sidebar's work" },
  "tabs.tsx": {
    count: 1,
    reason: "a scrolling tab list hides its scrollbar on purpose: edge fades and scroll buttons stand for it",
  },
}

const overflow = /\boverflow-(?:[xy]-)?(?:auto|scroll)\b/g
const directory = join(import.meta.dirname, "..", "registry", "ui")

test("a registry component scrolls its own content in a ScrollArea, or says why not", () => {
  const found: Record<string, number> = {}
  for (const file of readdirSync(directory)) {
    const count = readFileSync(join(directory, file), "utf8").match(overflow)?.length ?? 0
    if (count > 0) found[file] = count
  }
  const unexplained = Object.entries(found)
    .filter(([file, count]) => count > (allowed[file]?.count ?? 0))
    .map(([file, count]) => `${file}: ${String(count)}`)
  expect(unexplained, "use ScrollArea, or add the file to `allowed` with a reason").toEqual([])
  const stale = Object.entries(allowed)
    .filter(([file, { count }]) => (found[file] ?? 0) < count)
    .map(([file]) => file)
  expect(stale, "lower or remove these entries").toEqual([])
})
