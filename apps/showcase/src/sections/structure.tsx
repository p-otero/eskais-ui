import { useState } from "react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleIcon, CollapsiblePanel, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { ScrollArea, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaViewport } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs"

import { Section } from "../section"

const tasks = [
  {
    id: "t1",
    title: "Draft the release notes for every package in the workspace",
    owner: "Ada",
    status: "In progress",
  },
  { id: "t2", title: "Review the agent approval flow", owner: "Grace", status: "Done" },
  { id: "t3", title: "Audit contrast in the glass theme", owner: "Linus", status: "In progress" },
  { id: "t4", title: "Benchmark table rendering", owner: "Ada", status: "Done" },
]

type SortKey = "title" | "owner"
type Sort = { key: SortKey; direction: "ascending" | "descending" }

function SortableHead({
  label,
  column,
  sort,
  onSort,
}: {
  label: string
  column: SortKey
  sort: Sort
  onSort: (sort: Sort) => void
}) {
  const active = sort.key === column
  const next = active && sort.direction === "ascending" ? "descending" : "ascending"
  return (
    <TableHead aria-sort={active ? sort.direction : "none"}>
      <Button
        variant="ghost"
        size="sm"
        className="-mx-control-x"
        onClick={() => onSort({ key: column, direction: next })}
      >
        {label}
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={active ? "" : "opacity-40"}
        >
          <path d={active && sort.direction === "descending" ? "m6 9 6 6 6-6" : "m18 15-6-6-6 6"} />
        </svg>
      </Button>
    </TableHead>
  )
}

function TaskTable() {
  const [sort, setSort] = useState<Sort>({ key: "title", direction: "ascending" })
  const rows = tasks.toSorted((a, b) => {
    const order = a[sort.key].localeCompare(b[sort.key])
    return sort.direction === "ascending" ? order : -order
  })
  return (
    <Table aria-label="Tasks" className="min-w-lg">
      <TableCaption>
        Sorted by {sort.key}, {sort.direction}.
      </TableCaption>
      <TableHeader>
        <TableRow>
          <SortableHead label="Task" column="title" sort={sort} onSort={setSort} />
          <SortableHead label="Owner" column="owner" sort={sort} onSort={setSort} />
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((task) => (
          <TableRow key={task.id}>
            <TableCell className="max-w-56" title={task.title}>
              {task.title}
            </TableCell>
            <TableCell>{task.owner}</TableCell>
            <TableCell>
              <Badge variant={task.status === "Done" ? "success" : "info"}>{task.status}</Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function Column({ status, defaultOpen }: { status: string; defaultOpen?: boolean }) {
  const items = ["a", "b", "c", "d"].flatMap((copy) =>
    tasks.filter((task) => task.status === status).map((task) => ({ ...task, id: `${task.id}-${copy}` })),
  )
  return (
    <div className="w-full rounded-surface border sm:w-64">
      <Collapsible defaultOpen={defaultOpen}>
        <CollapsibleTrigger className="w-full">
          {status} column
          <CollapsibleIcon />
        </CollapsibleTrigger>
        <CollapsiblePanel>
          <Separator />
          <ScrollArea className="h-40">
            <ScrollAreaViewport render={<section aria-label={`${status} tasks`} />}>
              <ul className="flex flex-col gap-2 p-3 text-sm">
                {items.map((task) => (
                  <li key={task.id} className="rounded-control bg-muted px-3 py-2">
                    {task.title}
                  </li>
                ))}
              </ul>
            </ScrollAreaViewport>
            <ScrollAreaScrollbar>
              <ScrollAreaThumb />
            </ScrollAreaScrollbar>
          </ScrollArea>
        </CollapsiblePanel>
      </Collapsible>
    </div>
  )
}

const people = [
  { initials: "AL", name: "Ada Lovelace" },
  { initials: "GH", name: "Grace Hopper" },
  { initials: "LT", name: "Linus Torvalds" },
]

function StructureSection() {
  return (
    <>
      <Section
        title="Tabs, Collapsible and ScrollArea"
        description="Board views, collapsible columns and scrolling column bodies."
      >
        <Tabs defaultValue="board" className="w-full">
          <TabsList aria-label="Task view">
            <TabsTab value="board">Board</TabsTab>
            <TabsTab value="loading">Loading</TabsTab>
            <TabsTab value="empty">Empty</TabsTab>
          </TabsList>
          <TabsPanel value="board">
            <div className="flex flex-wrap items-start gap-3">
              <Column status="In progress" defaultOpen />
              <Column status="Done" />
            </div>
          </TabsPanel>
          <TabsPanel value="loading" aria-busy="true">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-16 w-full" />
            </div>
          </TabsPanel>
          <TabsPanel value="empty">
            <Empty>
              <EmptyHeader>
                <EmptyTitle render={<h3>No tasks yet</h3>} />
                <EmptyDescription>Tasks you or an agent create show up here.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button size="sm">Create task</Button>
              </EmptyContent>
            </Empty>
          </TabsPanel>
        </Tabs>
      </Section>

      <Section title="Table" description="Semantic table, aria-sort headers, truncated cells and horizontal scroll.">
        <TaskTable />
      </Section>

      <Section title="Avatar, Separator, Skeleton and Kbd" description="Small structural pieces on semantic tokens.">
        <ul className="flex flex-wrap gap-3 text-sm">
          {people.map((person) => (
            <li key={person.initials} className="flex items-center gap-2">
              <Avatar size="sm" aria-hidden="true">
                <AvatarFallback>{person.initials}</AvatarFallback>
              </Avatar>
              {person.name}
            </li>
          ))}
        </ul>
        <Separator orientation="vertical" className="h-6" />
        <div className="flex items-center gap-3">
          <Skeleton className="size-8" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Separator orientation="vertical" className="h-6" />
        <p className="text-sm text-muted-foreground">
          Search with{" "}
          <KbdGroup>
            <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
        </p>
      </Section>
    </>
  )
}

export { StructureSection }
