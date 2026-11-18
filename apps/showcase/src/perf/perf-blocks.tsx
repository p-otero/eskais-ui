import { useCallback, useMemo, useRef, useState } from "react"
import { CalendarIcon, FileTextIcon, FolderIcon, InboxIcon, SunIcon, UsersIcon } from "lucide-react"

import { DocumentOutline, DocumentQuickOpen, DocumentWorkspace } from "@/components/ui/document-workspace"
import { Link } from "@/components/ui/link"
import { List, ListItem } from "@/components/ui/list-item"
import { MarkdownEditor, type MarkdownEditorHandle } from "@/components/ui/markdown-editor"
import { extractHeadings, MarkdownView } from "@/components/ui/markdown-view"
import { MasterDetail } from "@/components/ui/master-detail"
import { PageHeader } from "@/components/ui/page-header"
import { PageLayout } from "@/components/ui/page-layout"
import { Shell, type ShellRoute, type ShellRouteGroup } from "@/components/ui/shell"
import { StatusPill } from "@/components/ui/status-pill"

const routeIcons = [InboxIcon, SunIcon, FolderIcon, CalendarIcon, UsersIcon]
const shellGroups: ShellRouteGroup[] = Array.from({ length: 6 }, (_, group) => ({
  id: `group-${String(group)}`,
  label: `Group ${String(group + 1)}`,
}))
const shellRoutes: ShellRoute[] = Array.from({ length: 60 }, (_, index) => ({
  id: `route-${String(index)}`,
  label: `Route ${String(index + 1)}`,
  href: `/route-${String(index)}`,
  icon: routeIcons[index % routeIcons.length] ?? InboxIcon,
  group: `group-${String(index % 6)}`,
  mobile: index < 4,
}))

/** A shell with 60 routes in 6 groups, routed through state like a client router. */
function ShellScenario() {
  const [current, setCurrent] = useState("/route-0")
  const onNavigate = useCallback((href: string) => setCurrent(href), [])
  return (
    <Shell
      routes={shellRoutes}
      groups={shellGroups}
      currentHref={current}
      onNavigate={onNavigate}
      brand={<span className="text-title-sm">Acme</span>}
      as="div"
    >
      <PageLayout width="dense" header={<PageHeader title={current} description="Benchmark page" />}>
        <p>Page content</p>
      </PageLayout>
    </Shell>
  )
}

const tones = ["success", "info", "warning", "destructive"] as const
const devices = Array.from({ length: 500 }, (_, index) => ({
  id: `dev-${String(index)}`,
  name: `Device ${String(index + 1)}`,
  room: `Room ${String((index % 40) + 1)}`,
  tone: tones[index % tones.length] ?? "success",
}))
const deviceItems = devices.map((device) => ({ id: device.id, label: device.name }))

/** MasterDetail over 500 rows; the detail follows focus, as in a mail client. */
function MasterDetailScenario() {
  return (
    <MasterDetail
      label="Devices"
      className="min-h-0 w-full flex-1"
      items={deviceItems}
      followFocus
      renderList={(state) => (
        <List aria-label="Devices">
          {devices.map((device) => (
            <ListItem
              key={device.id}
              {...state.itemProps(device.id)}
              title={device.name}
              subtitle={device.room}
              status={<StatusPill tone={device.tone}>{device.tone}</StatusPill>}
            />
          ))}
        </List>
      )}
      renderDetail={(id) => {
        const device = devices.find((candidate) => candidate.id === id)
        return device ? { title: device.name, description: device.room, content: <p>{device.id}</p> } : null
      }}
    />
  )
}

const notes = Array.from({ length: 300 }, (_, index) => ({
  slug: `note-${String(index)}`,
  title: `Note ${String(index + 1)}`,
  folder: `Folder ${String((index % 10) + 1)}`,
}))
const folders = [...new Set(notes.map((note) => note.folder))]
const longNote = Array.from(
  { length: 150 },
  (_, index) =>
    `## Heading ${String(index + 1)}\n\nA paragraph with **bold** text and a [[note-${String(index)}]] link.\n`,
).join("\n")
const quickOpenItems = notes.map((note) => ({ value: note.slug, label: note.title, description: note.folder }))

const readNote = Array.from(
  { length: 300 },
  (_, index) =>
    `## Section ${String(index + 1)}\n\nA paragraph with **bold** text, \`code\` and a [link](#s${String(index)}).\n\n- one\n- two\n- three\n`,
).join("\n")

/** A long note read with MarkdownView: 300 sections of a heading, a paragraph and a list, 900 blocks in all. */
function MarkdownViewScenario() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <MarkdownView markdown={readNote} className="max-w-prose" />
    </div>
  )
}

/** A notes workspace: 300 notes in the explorer, a 150-heading note in the editor, its outline beside it. */
function DocumentWorkspaceScenario() {
  const [markdown, setMarkdown] = useState(longNote)
  const [current, setCurrent] = useState("note-0")
  const editor = useRef<MarkdownEditorHandle>(null)
  const headings = useMemo(() => extractHeadings(markdown), [markdown])
  return (
    <DocumentWorkspace
      className="min-h-0 flex-1"
      editorRef={editor}
      headings={headings}
      explorer={
        <div className="flex flex-col gap-group px-inset-item py-inset-item">
          {folders.map((folder) => (
            <section key={folder} aria-label={folder} className="flex flex-col gap-inline">
              <h3 className="text-meta tracking-meta text-muted-foreground uppercase">{folder}</h3>
              <ul className="flex flex-col">
                {notes
                  .filter((note) => note.folder === folder)
                  .map((note) => (
                    <li key={note.slug}>
                      <Link
                        variant="plain"
                        href={`#/note/${note.slug}`}
                        current={note.slug === current}
                        onFollow={() => setCurrent(note.slug)}
                        className="flex items-center"
                      >
                        <FileTextIcon className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{note.title}</span>
                      </Link>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      }
      document={
        <MarkdownEditor
          ref={editor}
          label="Benchmark note"
          value={markdown}
          onChange={setMarkdown}
          className="min-h-0 flex-1"
        />
      }
      aside={<DocumentOutline />}
      quickOpen={<DocumentQuickOpen items={quickOpenItems} onOpen={setCurrent} />}
    />
  )
}

export { DocumentWorkspaceScenario, MarkdownViewScenario, MasterDetailScenario, ShellScenario }
