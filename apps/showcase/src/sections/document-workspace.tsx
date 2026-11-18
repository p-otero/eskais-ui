import DocumentWorkspaceDemo from "../../../site/src/examples/document-workspace"

import { Section } from "../section"

/**
 * ?demo=document-workspace: the docs site's demo inside a bare app shell whose <main> the block fills, as it would
 * in an app. tooling/document-workspace-check.mjs drives it and takes its screenshots.
 */
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
