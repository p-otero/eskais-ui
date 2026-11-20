import { CopyIcon, ExternalLinkIcon, PlayIcon, SquareIcon } from "lucide-react"
import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { List, ListItem } from "@/components/ui/list-item"
import type { ListRowAction } from "@/components/ui/list-row-actions"
import { MasterDetail } from "@/components/ui/master-detail"
import { StatusDot, StatusPill } from "@/components/ui/status-pill"

type Environment = { id: string; name: string; branch: string; url: string; running: boolean }

const initial: Environment[] = [
  { id: "main", name: "main", branch: "main", url: "http://localhost:5173", running: true },
  { id: "row-actions", name: "row-actions", branch: "feat/row-actions", url: "http://localhost:5174", running: true },
  {
    id: "theme-editor",
    name: "theme-editor",
    branch: "feat/theme-editor",
    url: "http://localhost:5175",
    running: false,
  },
  {
    id: "perf-budgets",
    name: "perf-budgets",
    branch: "chore/perf-budgets",
    url: "http://localhost:5176",
    running: true,
  },
  { id: "docs-search", name: "docs-search", branch: "fix/docs-search", url: "http://localhost:5177", running: false },
]

export default function Environments({ className = "h-112" }: { className?: string }) {
  const [environments, setEnvironments] = useState(initial)
  const [copied, setCopied] = useState<string | null>(null)
  const byId = new Map(environments.map((environment) => [environment.id, environment]))
  const setRunning = (id: string, running: boolean) =>
    setEnvironments((current) =>
      current.map((environment) => (environment.id === id ? { ...environment, running } : environment)),
    )

  const rowActions = (id: string): ListRowAction[] | undefined => {
    const environment = byId.get(id)
    if (!environment) return undefined
    return [
      {
        id: "open",
        label: "Open URL",
        icon: ExternalLinkIcon,
        href: environment.url,
        newTab: true,
        disabled: environment.running ? undefined : "Not running",
      },
      {
        id: "copy",
        label: "Copy URL",
        icon: CopyIcon,
        onAction: () => {
          void navigator.clipboard?.writeText(environment.url).catch(() => undefined)
          setCopied(environment.id)
        },
      },
      environment.running
        ? {
            id: "stop",
            label: "Stop",
            icon: SquareIcon,
            tone: "destructive",
            confirm: `Stops ${environment.name} and closes its dev server`,
            onAction: () => setRunning(environment.id, false),
          }
        : { id: "start", label: "Start", icon: PlayIcon, onAction: () => setRunning(environment.id, true) },
    ]
  }

  return (
    <MasterDetail
      label="Environments"
      className={`w-full rounded-surface border ${className}`}
      items={environments.map((environment) => ({ id: environment.id, label: environment.name }))}
      followFocus
      labels={{ list: "Environment list" }}
      header={
        <>
          <h2 className="text-title-sm tracking-tight">Environments</h2>
          <Badge variant="secondary">{environments.filter((environment) => environment.running).length} running</Badge>
        </>
      }
      renderList={(state) => (
        <List aria-label="Worktrees" rowActions={rowActions}>
          {environments.map((environment) => (
            <ListItem
              key={environment.id}
              {...state.itemProps(environment.id)}
              title={environment.name}
              leading={
                <StatusDot
                  tone={environment.running ? "success" : "neutral"}
                  label={environment.running ? "Running" : "Stopped"}
                />
              }
              subtitle={<span className="font-mono">{environment.url}</span>}
            />
          ))}
        </List>
      )}
      renderDetail={(id) => {
        const environment = byId.get(id)
        if (!environment) return null
        return {
          title: environment.name,
          description: environment.branch,
          content: (
            <dl className="flex flex-col gap-inline text-body-sm">
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <StatusPill tone={environment.running ? "success" : "neutral"}>
                  {environment.running ? "Running" : "Stopped"}
                </StatusPill>
              </dd>
              <dt className="text-muted-foreground">Local URL</dt>
              <dd className="font-mono">{environment.url}</dd>
              <dt className="text-muted-foreground">Branch</dt>
              <dd className="font-mono">{environment.branch}</dd>
              {copied === environment.id && <dd className="text-muted-foreground">URL copied</dd>}
            </dl>
          ),
        }
      }}
      emptyDetail={
        <Empty size="panel">
          <EmptyHeader>
            <EmptyTitle>No environment open</EmptyTitle>
            <EmptyDescription>
              Pick a worktree to see its branch and URL; its actions don&apos;t open it.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      }
    />
  )
}
