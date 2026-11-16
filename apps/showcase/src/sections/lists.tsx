import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { IconTile, List, ListGroup, ListItem } from "@/components/ui/list-item"
import { StatusDot, StatusPill } from "@/components/ui/status-pill"
import type { Tone } from "@/lib/tone"

import { Section } from "../section"

type Issue = {
  id: string
  title: string
  group: "proposed" | "active"
  status: { label: string; tone: Tone }
  labels: string[]
  updated: string
  owner: string
}

const issues: Issue[] = [
  {
    id: "ENG-412",
    title:
      "Webhook deliveries stop retrying after the first timeout when the receiver answers with a 502 from its load balancer",
    group: "proposed",
    status: { label: "Needs review", tone: "warning" },
    labels: ["api", "reliability"],
    updated: "12m",
    owner: "MK",
  },
  {
    id: "ENG-415",
    title: "Audit log export misses rows past 10,000",
    group: "proposed",
    status: { label: "Proposed", tone: "neutral" },
    labels: ["export"],
    updated: "1h",
    owner: "AS",
  },
  {
    id: "ENG-409",
    title: "Let admins pin a default workspace",
    group: "proposed",
    status: { label: "Proposed", tone: "neutral" },
    labels: ["settings"],
    updated: "3h",
    owner: "JR",
  },
  {
    id: "ENG-398",
    title: "Billing page shows last month's seat count",
    group: "active",
    status: { label: "In progress", tone: "info" },
    labels: ["billing", "bug"],
    updated: "2d",
    owner: "LT",
  },
  {
    id: "ENG-371",
    title: "Search index warms on every deploy",
    group: "active",
    status: { label: "Blocked", tone: "destructive" },
    labels: ["search"],
    updated: "4d",
    owner: "MK",
  },
]

const groups = [
  { id: "proposed", label: "Proposed" },
  { id: "active", label: "Active" },
] as const

const projects = [
  {
    id: "atlas",
    name: "Atlas",
    description: "Customer-facing API and webhooks",
    status: "success",
    open: 12,
    owner: "Platform",
  },
  {
    id: "borealis",
    name: "Borealis",
    description: "Billing, invoices and seat management",
    status: "warning",
    open: 7,
    owner: "Revenue",
  },
  {
    id: "cygnus",
    name: "Cygnus",
    description: "Search, indexing and ranking experiments",
    status: "destructive",
    open: 21,
    owner: "Discovery",
  },
] as const

function Avatar({ initials }: { initials: string }) {
  return (
    <span className="flex size-6 items-center justify-center rounded-full bg-secondary text-meta font-semibold text-secondary-foreground">
      {initials}
    </span>
  )
}

function IssueIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  )
}

function ListsSection() {
  const [selected, setSelected] = useState("ENG-398")
  const [triage, setTriage] = useState<string | null>("ENG-415")
  return (
    <Section
      title="ListItem"
      description="Dense rows that select through a stretched button or link, with groups, wrapped titles, a status that drops below the title on narrow rows, and the same row as a card."
    >
      <div className="flex w-full min-w-0 flex-col gap-6">
        <List aria-label="Issues">
          {groups.map((group) => {
            const rows = issues.filter((issue) => issue.group === group.id)
            return (
              <ListGroup key={group.id} label={group.label} count={rows.length}>
                {rows.map((issue) => (
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
                    trailing={
                      <>
                        <span>{issue.updated}</span>
                        <Avatar initials={issue.owner} />
                      </>
                    }
                    actions={
                      issue.group === "proposed" ? (
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
            )
          })}
        </List>

        <List aria-label="Projects" variant="card">
          {projects.map((project) => (
            <ListItem
              key={project.id}
              id={project.id}
              title={project.name}
              href={`#project-${project.id}`}
              selected={project.id === "atlas"}
              leading={
                <StatusDot
                  tone={project.status}
                  label={
                    project.status === "success" ? "Healthy" : project.status === "warning" ? "Degraded" : "Failing"
                  }
                />
              }
              subtitle={project.description}
              meta={
                <>
                  <span>{project.open} open</span>
                  <span aria-hidden="true">·</span>
                  <span>{project.owner}</span>
                </>
              }
            />
          ))}
        </List>

        <List aria-label="Triage queue" value={triage} onValueChange={setTriage}>
          {issues.slice(0, 3).map((issue) => (
            <ListItem
              key={issue.id}
              id={issue.id}
              title={issue.title}
              subtitle={<span className="font-mono">{issue.id}</span>}
              status={<StatusPill tone={issue.status.tone}>{issue.status.label}</StatusPill>}
            />
          ))}
        </List>
      </div>
    </Section>
  )
}

export { ListsSection }
