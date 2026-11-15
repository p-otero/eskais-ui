import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import axe from "axe-core"
import { expect, test } from "vitest"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Collapsible, CollapsibleIcon, CollapsiblePanel, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { ScrollArea, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaViewport } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs"

async function axeViolations(root: Element) {
  const result = await axe.run(root, { rules: { "color-contrast": { enabled: false } } })
  return result.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.html).join(", ")}`)
}

test("skeleton is hidden from assistive technology and accepts a render element", () => {
  const { container } = render(
    <>
      <Skeleton className="h-4 w-32" />
      <Skeleton render={<span />} />
    </>,
  )
  const [block, inline] = container.querySelectorAll<HTMLElement>('[data-slot="skeleton"]')
  expect(block?.getAttribute("aria-hidden")).toBe("true")
  expect(block?.className).toContain("motion-reduce:animate-none")
  expect(inline?.tagName).toBe("SPAN")
})

test("empty parts expose slots and accept a render element", () => {
  render(
    <Empty render={<section aria-label="No tasks" />}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <svg aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle render={<h2>No tasks yet</h2>} />
        <EmptyDescription>Tasks the agent creates show up here.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>Create one to get started.</EmptyContent>
    </Empty>,
  )
  expect(screen.getByRole("region", { name: "No tasks" }).dataset.slot).toBe("empty")
  expect(screen.getByRole("heading", { level: 2, name: "No tasks yet" }).dataset.slot).toBe("empty-title")
  expect(screen.getByText("Create one to get started.").dataset.slot).toBe("empty-content")
})

test("kbd renders keyboard input and accepts a render element", () => {
  render(
    <KbdGroup>
      <Kbd>Ctrl</Kbd>
      <Kbd render={<abbr title="Enter">⏎</abbr>} />
    </KbdGroup>,
  )
  const ctrl = screen.getByText("Ctrl")
  expect(ctrl.tagName).toBe("KBD")
  expect(ctrl.parentElement?.dataset.slot).toBe("kbd-group")
  expect(screen.getByTitle("Enter").dataset.slot).toBe("kbd")
})

test("table parts are semantic, scroll horizontally and carry aria-sort on headers", async () => {
  render(
    <Table aria-label="Tasks" containerClassName="max-w-md">
      <TableCaption>Open tasks</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead aria-sort="ascending">Title</TableHead>
          <TableHead render={<td>Owner</td>} />
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>Write the release notes for every package in the workspace</TableCell>
          <TableCell>Ada</TableCell>
        </TableRow>
      </TableBody>
    </Table>,
  )
  await act(async () => {})
  const table = screen.getByRole("table", { name: "Tasks" })
  expect(table.dataset.slot).toBe("table")
  expect(table.closest('[data-slot="scroll-area"]')?.className).toContain("max-w-md")
  const title = screen.getByRole("columnheader", { name: "Title" })
  expect(title.getAttribute("aria-sort")).toBe("ascending")
  expect(title.className).toContain("aria-[sort=ascending]:text-foreground")
  expect(screen.getByText("Owner").tagName).toBe("TD")
  expect(screen.getByRole("cell", { name: /release notes/ }).className).toContain("truncate")
  const scroller = createAgent()
    .snapshot()
    .find((entry) => entry.component === "scroll-area")
  expect(scroller?.label, "agents see the table's scroll area under the table's name").toBe("Tasks")
})

test("avatar shows its fallback without an image and separator keeps its orientation", () => {
  render(
    <>
      <Avatar size="sm">
        <AvatarImage alt="Ada Lovelace" />
        <AvatarFallback>AL</AvatarFallback>
      </Avatar>
      <Separator orientation="vertical" />
    </>,
  )
  expect(screen.getByText("AL").dataset.slot).toBe("avatar-fallback")
  const separator = screen.getByRole("separator")
  expect(separator.getAttribute("aria-orientation")).toBe("vertical")
  expect(separator.dataset.orientation).toBe("vertical")
})

test("a page built from the structure components has no axe violations, closed or open", async () => {
  const user = userEvent.setup()
  const { container } = render(
    <main>
      <h1>Tasks</h1>
      <Tabs defaultValue="board">
        <TabsList aria-label="View">
          <TabsTab value="board">Board</TabsTab>
          <TabsTab value="table">Table</TabsTab>
        </TabsList>
        <TabsPanel value="board">
          <Collapsible>
            <CollapsibleTrigger>
              In progress
              <CollapsibleIcon />
            </CollapsibleTrigger>
            <CollapsiblePanel>
              <ScrollArea className="h-40">
                <ScrollAreaViewport render={<section aria-label="In progress tasks" />}>
                  <Skeleton className="h-4 w-full" />
                </ScrollAreaViewport>
                <ScrollAreaScrollbar>
                  <ScrollAreaThumb />
                </ScrollAreaScrollbar>
              </ScrollArea>
            </CollapsiblePanel>
          </Collapsible>
          <Separator />
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No tasks</EmptyTitle>
              <EmptyDescription>
                Press <Kbd>N</Kbd> to add one.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </TabsPanel>
        <TabsPanel value="table">
          <Table aria-label="Tasks">
            <TableHeader>
              <TableRow>
                <TableHead aria-sort="none">Title</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Ship it</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TabsPanel>
      </Tabs>
      <Avatar>
        <AvatarFallback>
          <span aria-hidden="true">AL</span>
          <span className="sr-only">Ada Lovelace</span>
        </AvatarFallback>
      </Avatar>
    </main>,
  )
  expect(await axeViolations(container)).toEqual([])
  await user.click(screen.getByRole("button", { name: "In progress" }))
  expect(await axeViolations(container)).toEqual([])
  await user.click(screen.getByRole("tab", { name: "Table" }))
  expect(await axeViolations(container)).toEqual([])
})
