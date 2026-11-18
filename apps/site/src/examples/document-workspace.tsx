import { useCallback, useMemo, useRef, useState, type RefObject } from "react"
import { FileTextIcon, FolderIcon, ImageIcon, PlusIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import {
  DocumentOutline,
  DocumentQuickOpen,
  DocumentWorkspace,
  useDocumentWorkspace,
  type DocumentSaveState,
  type DocumentWorkspaceMode,
} from "@/components/ui/document-workspace"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemIcon,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Link } from "@/components/ui/link"
import {
  MarkdownEditor,
  markdownSlashCommands,
  type MarkdownEditorHandle,
  type SlashCommand,
} from "@/components/ui/markdown-editor"
import { extractHeadings, MarkdownView, parseFrontmatter } from "@/components/ui/markdown-view"
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@/components/ui/segmented-control"
import { Tabs, TabsIndicator, TabsList, TabsTab } from "@/components/ui/tabs"

import { initialNotes, snippetOf, titleOf } from "./document-workspace-notes"

function Timeline({ alias }: { alias?: string }) {
  return (
    <figure className="flex items-center gap-items rounded-surface border bg-muted px-inset-item py-inset-item text-body-sm">
      <ImageIcon className="size-4 text-muted-foreground" />
      <figcaption>{alias ?? "Timeline: beta in September, launch in October"}</figcaption>
    </figure>
  )
}

const renderEmbed = (target: string, alias: string | undefined) =>
  target === "timeline" ? <Timeline alias={alias} /> : <span className="text-muted-foreground">{alias ?? target}</span>

/** The toolbar slot: a host menu that drives the editor through its handle, and gives focus back to the document. */
function InsertMenu({ editor }: { editor: RefObject<MarkdownEditorHandle | null> }) {
  const workspace = useDocumentWorkspace()
  return (
    <DropdownMenu
      onAction={(value) => {
        const handle = editor.current
        if (!handle) return
        if (value === "link") handle.insertLink("https://eskais.dev", "Eskais")
        if (value === "wikilink") handle.insertWikilink("risks", "the risks")
        if (value === "note") handle.openWikilinkSuggestions()
        if (value === "embed") handle.insertText("![[timeline]]")
        if (value === "highlight") handle.wrapSelection("==")
      }}
    >
      <DropdownMenuTrigger variant="ghost" size="sm" disabled={workspace.mode === "read"}>
        <PlusIcon />
        Insert
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" finalFocus={workspace.documentFocusTarget}>
        <DropdownMenuItem value="link">Link</DropdownMenuItem>
        <DropdownMenuItem value="wikilink">Wikilink</DropdownMenuItem>
        <DropdownMenuItem value="note">Link to a note…</DropdownMenuItem>
        <DropdownMenuItem value="embed">
          <DropdownMenuItemIcon>
            <ImageIcon />
          </DropdownMenuItemIcon>
          Embed
        </DropdownMenuItem>
        <DropdownMenuItem value="highlight">Highlight selection</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

type SaveSimulation = "ok" | "error" | "conflict"

export default function DocumentWorkspaceDemo({ className = "h-144 w-full" }: { className?: string }) {
  const [notes, setNotes] = useState(initialNotes)
  const [open, setOpen] = useState(["launch-plan", "goals"])
  const [current, setCurrent] = useState("launch-plan")
  const [mode, setMode] = useState<DocumentWorkspaceMode>("edit")
  const [saveState, setSaveState] = useState<DocumentSaveState>("saved")
  const [simulation, setSimulation] = useState<SaveSimulation>("ok")
  const [conflict, setConflict] = useState(false)
  const editor = useRef<MarkdownEditorHandle>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const note = notes.find((entry) => entry.slug === current) ?? notes[0]!
  const headings = useMemo(() => extractHeadings(note.markdown), [note.markdown])
  const properties = parseFrontmatter(note.markdown)?.properties ?? []
  const backlinks = notes.filter((entry) => entry.slug !== note.slug && entry.markdown.includes(`[[${note.slug}`))
  const words = note.markdown.split(/\s+/).filter(Boolean).length

  const openNote = useCallback((slug: string) => {
    const target = slug.split("#")[0] ?? slug
    setOpen((tabs) => (tabs.includes(target) ? tabs : [...tabs, target]))
    setCurrent(target)
  }, [])
  const resolveWikilink = useCallback(
    (slug: string) => ({ exists: titleOf(notes, slug) !== undefined, label: titleOf(notes, slug) }),
    [notes],
  )
  const wikilinkHref = useCallback(
    (slug: string) => (titleOf(notes, slug) ? `#/note/${slug.split("#")[0] ?? slug}` : undefined),
    [notes],
  )
  const onWikilinkClick = useCallback((slug: string) => openNote(slug), [openNote])
  const suggestWikilinks = useCallback(
    async (query: string) =>
      notes
        .filter((entry) => entry.title.toLowerCase().includes(query.toLowerCase()))
        .map((entry) => ({ slug: entry.slug, label: entry.title })),
    [notes],
  )

  // Link to a note calls the handle from `run`: the suggestions open once the slash menu has closed.
  const slashCommands: SlashCommand[] = [
    ...markdownSlashCommands(),
    {
      value: "note",
      label: "Link to a note",
      keywords: ["wikilink"],
      hint: "[[",
      run: (view, range) => {
        view.dispatch({ changes: range, selection: { anchor: range.from }, userEvent: "input.complete" })
        editor.current?.openWikilinkSuggestions()
      },
    },
  ]

  const save = (markdown: string) => {
    setNotes((all) => all.map((entry) => (entry.slug === current ? { ...entry, markdown } : entry)))
    setSaveState("saving")
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      if (simulation === "conflict") setConflict(true)
      setSaveState(simulation === "ok" ? "saved" : "error")
    }, 700)
  }

  const folders = [...new Set(notes.map((entry) => entry.folder))]

  return (
    <div className={`flex flex-col gap-items ${className}`}>
      <div className="flex flex-wrap items-center gap-items text-body-sm text-muted-foreground">
        <span id="save-simulation">Next save</span>
        <SegmentedControl<SaveSimulation>
          aria-labelledby="save-simulation"
          value={simulation}
          onValueChange={(next) => next && setSimulation(next)}
        >
          <SegmentedControlIndicator />
          <SegmentedControlItem value="ok">Succeeds</SegmentedControlItem>
          <SegmentedControlItem value="error">Fails</SegmentedControlItem>
          <SegmentedControlItem value="conflict">Conflicts</SegmentedControlItem>
        </SegmentedControl>
      </div>
      <DocumentWorkspace
        className="min-h-0 flex-1 rounded-surface border"
        documentId={current}
        mode={mode}
        onModeChange={setMode}
        storageKey="eskais-demo-workspace"
        editorRef={editor}
        headings={headings}
        saveState={saveState}
        alert={
          conflict ? (
            <Alert
              tone="warning"
              action={
                <Button size="sm" variant="outline" onClick={() => setConflict(false)}>
                  Keep mine
                </Button>
              }
            >
              <AlertTitle>Changed on another device</AlertTitle>
              <AlertDescription>Someone edited this note while you were typing.</AlertDescription>
            </Alert>
          ) : undefined
        }
        explorer={
          <div className="flex flex-col gap-group px-inset-item py-inset-item">
            <section aria-labelledby="recent-notes" className="flex flex-col gap-inline">
              <h3 id="recent-notes" className="text-meta tracking-meta text-muted-foreground uppercase">
                Recent
              </h3>
              <ul className="flex flex-col">
                {open.map((slug) => (
                  <li key={slug}>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-current={slug === current ? "page" : undefined}
                      onClick={() => openNote(slug)}
                      className="w-full justify-start font-normal aria-[current]:bg-accent aria-[current]:text-accent-foreground"
                    >
                      {titleOf(notes, slug)}
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
            {folders.map((folder) => (
              <section key={folder} aria-label={folder} className="flex flex-col gap-inline">
                <h3 className="flex items-center gap-inline text-meta tracking-meta text-muted-foreground uppercase">
                  <FolderIcon className="size-3.5" />
                  {folder}
                </h3>
                <ul className="flex flex-col">
                  {notes
                    .filter((entry) => entry.folder === folder)
                    .map((entry) => (
                      <li key={entry.slug}>
                        <Link
                          variant="plain"
                          href={`#/note/${entry.slug}`}
                          current={entry.slug === current}
                          onFollow={() => openNote(entry.slug)}
                          className="flex items-center gap-inline rounded-control px-inset-item py-inline text-body-sm outline-none pointer-coarse:min-h-(--control-height-touch) hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring aria-[current]:bg-accent aria-[current]:font-medium aria-[current]:text-accent-foreground"
                        >
                          <FileTextIcon className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">{entry.title}</span>
                        </Link>
                      </li>
                    ))}
                </ul>
              </section>
            ))}
          </div>
        }
        tabs={
          <Tabs value={current} onValueChange={(next) => next && setCurrent(String(next))}>
            <TabsList aria-label="Open notes" className="max-w-full">
              <TabsIndicator />
              {open.map((slug) => (
                <TabsTab key={slug} value={slug}>
                  {titleOf(notes, slug)}
                </TabsTab>
              ))}
            </TabsList>
          </Tabs>
        }
        breadcrumb={
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>{note.folder}</BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{note.title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        }
        toolbar={<InsertMenu editor={editor} />}
        document={
          mode === "edit" ? (
            <MarkdownEditor
              key={note.slug}
              ref={editor}
              label={note.title}
              value={note.markdown}
              onChange={save}
              onDirtyChange={(dirty) => dirty && setSaveState("unsaved")}
              resolveWikilink={resolveWikilink}
              onWikilinkClick={onWikilinkClick}
              suggestWikilinks={suggestWikilinks}
              slashCommands={slashCommands}
              embedPreview
              renderEmbed={renderEmbed}
              className="min-h-0 flex-1 rounded-none border-0 bg-transparent shadow-none has-[.cm-focused]:ring-0"
            />
          ) : (
            <MarkdownView
              markdown={note.markdown}
              resolveWikilink={resolveWikilink}
              wikilinkHref={wikilinkHref}
              onWikilinkClick={onWikilinkClick}
              renderEmbed={renderEmbed}
              frontmatter="properties"
              className="max-w-2xl"
            />
          )
        }
        aside={
          <div className="flex flex-col gap-group px-inset-item py-inset-item">
            <DocumentOutline />
            <section aria-labelledby="backlinks" className="flex flex-col gap-inline">
              <h3 id="backlinks" className="text-meta tracking-meta text-muted-foreground uppercase">
                Backlinks
              </h3>
              {backlinks.length ? (
                <ul className="flex flex-col gap-inline">
                  {backlinks.map((entry) => (
                    <li key={entry.slug}>
                      <Link
                        variant="muted"
                        href={`#/note/${entry.slug}`}
                        onFollow={() => openNote(entry.slug)}
                        className="inline-flex min-h-6 items-center"
                      >
                        {entry.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-body-sm text-muted-foreground">No notes link here.</p>
              )}
            </section>
            {properties.length > 0 && (
              <section aria-labelledby="properties" className="flex flex-col gap-inline">
                <h3 id="properties" className="text-meta tracking-meta text-muted-foreground uppercase">
                  Properties
                </h3>
                <dl className="flex flex-col gap-inline text-body-sm">
                  {properties.map((property) => (
                    <div key={property.key} className="flex justify-between gap-group">
                      <dt className="text-muted-foreground">{property.key}</dt>
                      <dd>{typeof property.value === "string" ? property.value : property.value.join(", ")}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
          </div>
        }
        statusBar={<span>{words} words</span>}
        quickOpen={
          <DocumentQuickOpen
            items={notes.map((entry) => ({
              value: entry.slug,
              label: entry.title,
              description: entry.folder,
              snippet: snippetOf(entry.markdown),
            }))}
            onOpen={openNote}
            labels={{ placeholder: "Go to a note" }}
          />
        }
      />
    </div>
  )
}
