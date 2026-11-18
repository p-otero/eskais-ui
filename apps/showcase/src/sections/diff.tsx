import { useState } from "react"

import { GitDiff } from "@/components/ui/git-diff"
import { TextDiff } from "@/components/ui/text-diff"
import type { DiffLineSelection } from "@/components/ui/diff-view-document"
import { toast } from "@/components/ui/toast"

import { Section } from "../section"
import { newStat, oldStat, reviewPatch } from "./diff-fixtures"

function describe(selection: DiffLineSelection) {
  const { start, end, path } = selection
  const range = start.line === end.line ? String(start.line) : `${String(start.line)}–${String(end.line)}`
  return `${path || "stat.tsx"}: ${start.side} line ${range}`
}

function DiffSection() {
  const [selected, setSelected] = useState("Click a line number, Shift-click to extend.")
  return (
    <Section
      title="Diff"
      description="TextDiff compares two strings; GitDiff renders a patch with a file tree, headers, viewed state, j/k between hunks and line selection."
    >
      <div className="flex w-full min-w-0 flex-col gap-group">
        <TextDiff
          aria-label="stat.tsx changes"
          oldText={oldStat}
          newText={newStat}
          language="tsx"
          context={1}
          onLineSelect={(selection) => setSelected(selection ? describe(selection) : "No lines selected")}
        />
        <TextDiff
          aria-label="stat.tsx side by side"
          oldText={oldStat}
          newText={newStat}
          language="tsx"
          defaultLayout="split"
          defaultWrap
        />
        <p className="text-body-sm text-muted-foreground" aria-live="polite">
          {selected}
        </p>
        <GitDiff
          aria-label="Review changes"
          patch={reviewPatch}
          className="h-144"
          onViewedChange={(viewed) => toast(`${String(viewed.length)} viewed`)}
        />
      </div>
    </Section>
  )
}

export { DiffSection }
