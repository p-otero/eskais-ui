import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Chalkboard, type ChalkboardContent } from "@/components/ui/chalkboard"

import { agent } from "../agent"
import "../../../../registry/styles/chalkboard.css"

declare global {
  interface Window {
    /** Read by tooling/signs-check.mjs: the agent bridge. */
    chalkProbe?: { agent: typeof agent }
  }
}

window.chalkProbe = { agent }

const lunch: ChalkboardContent = [
  { type: "heading", text: "Today's menu" },
  {
    type: "menu",
    items: [
      { name: "Leek and potato soup", price: "4.50" },
      { name: "Grilled sardines", price: "9.80", note: "with lemon and parsley" },
      { name: "Mushroom risotto", price: "11.00" },
      { name: "Apple crumble", price: "5.20" },
    ],
  },
  { type: "text", text: "Coffee & a pastry · 3.20", color: "yellow" },
]

const evening = `# Tonight
- Quiz night from 8
- Live music on Friday
Draught cider ... 4.80
Hot chocolate ... 3.10`

function ChalkboardDemo() {
  const [content, setContent] = useState<ChalkboardContent>(lunch)
  return (
    <main className="flex min-h-dvh justify-center bg-background p-inset-surface text-foreground">
      <div className="flex w-full max-w-3xl flex-col gap-group">
        <header className="flex flex-wrap items-end justify-between gap-items">
          <h1 className="text-display-sm tracking-tight">Chalkboard</h1>
          <Button variant="outline" onClick={() => setContent(content === lunch ? evening : lunch)}>
            Wipe and rewrite
          </Button>
        </header>
        <Chalkboard label="Today's menu" content={content} onContentChange={setContent} reveal />
        <Chalkboard
          label="Notices"
          surface="green"
          tray={false}
          defaultContent={[
            { type: "heading", text: "Notices", color: "pink" },
            { type: "list", items: ["Kitchen closes at 22:30", "Dogs welcome on the terrace"] },
          ]}
        />
      </div>
    </main>
  )
}

export { ChalkboardDemo }
