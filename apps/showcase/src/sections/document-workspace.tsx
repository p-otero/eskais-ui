import DocumentWorkspaceDemo from "../../../site/src/examples/document-workspace"

import { Section } from "../section"

function DocumentWorkspacePage() {
  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <header className="flex h-(--topbar-height,3.5rem) shrink-0 items-center border-b px-inset-surface text-title-sm">
        Notes
      </header>
      <main id="main" className="flex min-h-0 flex-1 flex-col p-inset-surface narrow:p-inline">
        <DocumentWorkspaceDemo className="min-h-0 flex-1" />
      </main>
    </div>
  )
}

function DocumentWorkspaceSection() {
  return (
    <Section
      title="Document workspace"
      description="A notes workspace: explorer, tabs, the editor or the read view, outline and backlinks. Ctrl or Cmd+P opens quick open; narrow containers turn the side columns into drawers. ?demo=document-workspace shows it alone."
    >
      <DocumentWorkspaceDemo className="h-160 w-full" />
    </Section>
  )
}

export { DocumentWorkspacePage, DocumentWorkspaceSection }
