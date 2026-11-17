import { useState } from "react"

import { Button } from "@/components/ui/button"
import { List, ListItem } from "@/components/ui/list-item"
import { SidePanel } from "@/components/ui/side-panel"

const tickets = [
  { id: "SUP-201", title: "Export stops at 10,000 rows", body: "The CSV ends mid-month; the API returns the rest." },
  { id: "SUP-198", title: "Invite email lands in spam", body: "Two customers on the same mail host this week." },
  { id: "SUP-190", title: "Dark mode chart legend is hard to read", body: "The legend uses the light palette." },
]

export default function SidePanelDemo() {
  const [openId, setOpenId] = useState<string | null>(null)
  const [solved, setSolved] = useState<string[]>([])
  const open = tickets.find((ticket) => ticket.id === openId)
  return (
    <div className="relative flex h-80 w-full overflow-hidden rounded-surface border">
      <div className="min-h-0 flex-1 overflow-y-auto p-inline">
        <List aria-label="Tickets">
          {tickets.map((ticket) => (
            <ListItem
              key={ticket.id}
              id={ticket.id}
              title={ticket.title}
              subtitle={solved.includes(ticket.id) ? `${ticket.id} · Solved` : ticket.id}
              selected={ticket.id === openId}
              onSelect={() => setOpenId(ticket.id)}
            />
          ))}
        </List>
      </div>
      <SidePanel
        open={open !== undefined}
        onOpenChange={(next) => !next && setOpenId(null)}
        title={open?.title}
        description={open?.id}
        scopeLabel="Ticket"
        returnFocus={() =>
          document
            .querySelector<HTMLElement>(`[data-item-id="${openId ?? ""}"] [data-slot="list-item-title"]`)
            ?.closest("button")
        }
      >
        <Button
          variant="outline"
          size="sm"
          shortcut="s"
          className="self-start"
          onClick={() => open && setSolved((current) => [...current, open.id])}
        >
          Mark solved
        </Button>
        <p className="text-body">{open?.body}</p>
      </SidePanel>
    </div>
  )
}
