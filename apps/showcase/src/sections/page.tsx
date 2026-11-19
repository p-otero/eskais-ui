import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataState, type DataStatus } from "@/components/ui/data-state"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { ErrorState } from "@/components/ui/error-state"
import { Field, FieldLabel } from "@/components/ui/field"
import { LoadingState } from "@/components/ui/loading-state"
import { PageHeader } from "@/components/ui/page-header"
import { PageLayout } from "@/components/ui/page-layout"
import { Section as PageSectionBlock } from "@/components/ui/section"
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@/components/ui/segmented-control"
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs"

import { Section } from "../section"

const demoStatuses = ["pending", "error", "empty", "success", "refetching"] as const
type DemoStatus = (typeof demoStatuses)[number]

type Project = { id: string; name: string; deployed: string; state: "Ready" | "Building" | "Failed" }

const projects: Project[] = [
  { id: "apollo", name: "Apollo", deployed: "2 hours ago", state: "Ready" },
  { id: "gemini", name: "Gemini", deployed: "Yesterday", state: "Building" },
  {
    id: "mercury-observability-pipeline",
    name: "Mercury observability pipeline",
    deployed: "3 days ago",
    state: "Failed",
  },
]

const tones = { Ready: "success", Building: "info", Failed: "destructive" } as const

function query(status: DemoStatus): { status: DataStatus; data: Project[] | undefined; error?: Error } {
  switch (status) {
    case "pending":
      return { status: "pending", data: undefined }
    case "error":
      return {
        status: "error",
        data: undefined,
        error: new Error("The projects service answered 503. Try again in a minute."),
      }
    case "empty":
      return { status: "success", data: [] }
    case "refetching":
      return { status: "pending", data: projects }
    default:
      return { status: "success", data: projects }
  }
}

function ProjectList({ items }: { items: Project[] }) {
  return (
    <ul aria-label="Projects" className="flex flex-col divide-y">
      {items.map((project) => (
        <li key={project.id} className="flex flex-wrap items-center justify-between gap-items py-inset-item">
          <div className="flex min-w-0 flex-col">
            <span className="font-medium wrap-anywhere">{project.name}</span>
            <span className="text-caption text-muted-foreground">Deployed {project.deployed}</span>
          </div>
          <Badge tone={tones[project.state]}>{project.state}</Badge>
        </li>
      ))}
    </ul>
  )
}

function PageDemo({ status, as }: { status: DemoStatus; as?: "main" }) {
  const result = query(status)
  return (
    <Tabs defaultValue="overview">
      <PageLayout
        as={as}
        width="dense"
        header={
          <PageHeader
            eyebrow="Workspace"
            title="Projects"
            description="Every project in the workspace, with its latest deployment."
            actions={<Button>New project</Button>}
            tabs={
              <TabsList aria-label="Project views">
                <TabsTab value="overview">Overview</TabsTab>
                <TabsTab value="activity">Activity</TabsTab>
                <TabsTab value="settings">Settings</TabsTab>
              </TabsList>
            }
          />
        }
      >
        <TabsPanel value="overview">
          <div className="flex flex-col gap-section">
            <div className="grid gap-section md:grid-cols-3">
              <PageSectionBlock
                className="md:col-span-2"
                eyebrow="Last 7 days"
                title="Deployments"
                description="Builds that reached production."
                action={
                  <Button size="sm" variant="outline">
                    Export
                  </Button>
                }
              >
                <p className="text-display-sm">42</p>
              </PageSectionBlock>
              <PageSectionBlock title="Team" padding="sm" footer={<span className="text-sm">4 members</span>}>
                <p className="text-sm text-muted-foreground">Ada, Grace, Linus and Margaret.</p>
              </PageSectionBlock>
            </div>
            <PageSectionBlock title="All projects" description="Sorted by last deployment.">
              <DataState
                status={result.status}
                data={result.data}
                error={result.error}
                onRetry={() => {}}
                labels={{
                  loading: "Loading projects",
                  errorTitle: "Couldn't load projects",
                  retry: "Retry loading projects",
                  emptyTitle: "No projects yet",
                  emptyDescription: "Create one from a template to see it here.",
                }}
              >
                {(items) => <ProjectList items={items} />}
              </DataState>
            </PageSectionBlock>
            <PageSectionBlock
              surface="dashed"
              title="Create a project"
              description="Start from a template or an empty repo."
            >
              <Button variant="secondary">Choose a template</Button>
            </PageSectionBlock>
          </div>
        </TabsPanel>
        <TabsPanel value="activity">
          <p className="text-sm text-muted-foreground">Recent activity.</p>
        </TabsPanel>
        <TabsPanel value="settings">
          <p className="text-sm text-muted-foreground">Project settings.</p>
        </TabsPanel>
      </PageLayout>
    </Tabs>
  )
}

function PageSection() {
  const [status, setStatus] = useState<DemoStatus>("success")
  return (
    <Section
      title="Page layout and header"
      description='PageLayout, PageHeader (eyebrow, tabs, actions that wrap below the title on narrow screens), Section (card, padding sm, dashed create tile) and DataState. PageLayout centers a dense, wide or full column; as="main" makes it the main landmark.'
    >
      <Field className="max-w-full overflow-x-auto">
        <FieldLabel>Data state</FieldLabel>
        <SegmentedControl<DemoStatus> value={status} onValueChange={(next) => next && setStatus(next)}>
          <SegmentedControlIndicator />
          {demoStatuses.map((name) => (
            <SegmentedControlItem key={name} value={name}>
              {name.charAt(0).toUpperCase() + name.slice(1)}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      </Field>
      <div className="w-full overflow-hidden rounded-surface border bg-background">
        <PageDemo status={status} />
      </div>
    </Section>
  )
}

function StatesSection() {
  return (
    <Section
      title="States"
      description="LoadingState (spinner or skeleton, busy, label for screen readers), ErrorState (alert, retry, collapsible details) and Empty in three sizes."
    >
      <div className="grid w-full gap-3 md:grid-cols-2">
        <div className="flex rounded-surface border">
          <LoadingState label="Loading builds" />
        </div>
        <div className="flex rounded-surface border">
          <LoadingState label="Loading build log" variant="skeleton" rows={4} />
        </div>
        <ErrorState
          title="Couldn't load builds"
          message="The request timed out after 30 seconds."
          onRetry={() => new Promise((resolve) => setTimeout(resolve, 1200))}
          retryLabel="Retry builds"
          details="GET /api/builds → 504 Gateway Timeout (request 7f3a9c)"
          detailsLabel="Technical details"
        />
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No builds yet</EmptyTitle>
            <EmptyDescription>Push a commit to start one.</EmptyDescription>
          </EmptyHeader>
        </Empty>
        <Empty size="inline">
          <EmptyTitle>No comments</EmptyTitle>
          <EmptyDescription>Inline, for a list or a table cell.</EmptyDescription>
        </Empty>
        <ErrorState size="inline" title="Couldn't load comments" retryLabel="Retry comments" onRetry={() => {}} />
      </div>
    </Section>
  )
}

export { demoStatuses, PageDemo, PageSection, StatesSection }
export type { DemoStatus }
