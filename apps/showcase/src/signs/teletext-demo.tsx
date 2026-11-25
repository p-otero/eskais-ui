import { useState } from "react"

import { Teletext } from "@/components/ui/teletext"

import { agent } from "../agent"
import "../../../../registry/styles/teletext.css"
import { teletextDemoPages } from "./teletext-pages"

declare global {
  interface Window {
    /** Read by tooling/signs-check.mjs: the agent bridge. */
    teletextProbe?: { agent: typeof agent }
  }
}

window.teletextProbe = { agent }

function TeletextDemo() {
  const [page, setPage] = useState(100)
  return (
    <main className="flex min-h-dvh justify-center bg-background p-inset-surface text-foreground">
      <div className="flex w-full max-w-3xl flex-col gap-group">
        <header className="flex flex-wrap items-end justify-between gap-items">
          <h1 className="text-display-sm tracking-tight">Teletext</h1>
          <p className="text-body-sm text-muted-foreground" aria-live="polite">{`Page ${String(page)}`}</p>
        </header>
        <Teletext label="Teletext" service="ESKAIS" pages={teletextDemoPages} page={page} onPageChange={setPage} />
        <p className="max-w-prose text-body-sm text-muted-foreground">
          Focus the screen and type 101, 400 or 600, or use the coloured keys. Left and Right turn the news subpages.
        </p>
      </div>
    </main>
  )
}

export { TeletextDemo }
