import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { IconTile, List, ListGroup, ListItem } from "@/components/ui/list-item"
import { StatusPill } from "@/components/ui/status-pill"
import type { Tone } from "@/lib/tone"

type Issue = { id: string; title: string; status: { label: string; tone: Tone }; labels: string[]; proposed: boolean }

const issues: Issue[] = [
  {
    id: "ENG-412",
    title: "Webhook deliveries stop retrying after the first timeout from a load balancer",
    status: { label: "Needs review", tone: "warning" },
    labels: ["api", "reliability"],
    proposed: true,
  },
  {
    id: "ENG-398",
    title: "Billing page shows last month's seat count",
    status: { label: "In progress", tone: "info" },
    labels: ["billing"],
    proposed: false,
  },
  {
    id: "ENG-371",
    title: "Search index warms on every deploy",
    status: { label: "Blocked", tone: "destructive" },
    labels: ["search"],
    proposed: false,
  },
]

function IssueIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  )
}

export default function ListItemDemo() {
  const [selected, setSelected] = useState("ENG-398")
  return (
    <List aria-label="Issues" className="w-full">
      <ListGroup label="This cycle" count={issues.length}>
        {issues.map((issue) => (
          <ListItem
            key={issue.id}
            id={issue.id}
            title={issue.title}
            leading={
              <IconTile tone={issue.status.tone}>
                <IssueIcon />
              </IconTile>
            }
            subtitle={<span className="font-mono">{issue.id}</span>}
            status={<StatusPill tone={issue.status.tone}>{issue.status.label}</StatusPill>}
            meta={issue.labels.map((label) => (
              <Badge key={label} variant="outline">
                {label}
              </Badge>
            ))}
            actions={
              issue.proposed ? (
                <Button size="sm" variant="outline" aria-label={`Approve ${issue.id}`}>
                  Approve
                </Button>
              ) : undefined
            }
            selected={selected === issue.id}
            onSelect={() => setSelected(issue.id)}
          />
        ))}
      </ListGroup>
    </List>
  )
}
