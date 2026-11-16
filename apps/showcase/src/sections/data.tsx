import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Carousel,
  CarouselContent,
  CarouselIndicator,
  CarouselIndicatorGroup,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  CarouselViewport,
} from "@/components/ui/carousel"
import { DataTable, type DataTableColumn } from "@/components/ui/data-table"
import { DatePicker } from "@/components/ui/date-picker"
import { FilterBar, FilterBarButton, FilterBarSearch } from "@/components/ui/filter-bar"
import { PageHeader } from "@/components/ui/page-header"
import { Resizable, ResizableHandle, ResizablePanel } from "@/components/ui/resizable"
import { Sidebar, SidebarGroup, SidebarItem } from "@/components/ui/sidebar"

import { Section } from "../section"

type Deployment = { id: string; project: string; region: string; minutes: number | null }

const regions = ["eu-west", "us-east", "ap-south"]
const deployments: Deployment[] = Array.from({ length: 23 }, (_, index) => ({
  id: `dep-${index + 1}`,
  project: ["Apollo", "Borealis", "Cygnus", "Draco"][index % 4] + ` #${index + 1}`,
  region: regions[index % 3] as string,
  minutes: index % 7 === 3 ? null : ((index * 37) % 50) + 2,
}))

const columns: DataTableColumn<Deployment>[] = [
  { id: "project", header: "Project", cell: (row) => row.project, sortValue: (row) => row.project },
  { id: "region", header: "Region", cell: (row) => row.region, sortValue: (row) => row.region },
  {
    id: "minutes",
    header: "Build minutes",
    cell: (row) => row.minutes ?? "—",
    sortValue: (row) => row.minutes,
    align: "end",
  },
]

function Glyph({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

function DeploymentsDemo() {
  const [query, setQuery] = useState("")
  const [mine, setMine] = useState(false)
  const [loading, setLoading] = useState(false)
  const rows = deployments.filter(
    (row) => row.project.toLowerCase().includes(query.toLowerCase()) && (!mine || row.region === "eu-west"),
  )
  return (
    <div className="flex w-full flex-col gap-4">
      <PageHeader
        headingLevel={3}
        title="Deployments"
        description="Sortable, selectable and paginated, with a filter toolbar."
        breadcrumb={<span>Projects / All</span>}
        actions={
          <Button variant="outline" size="sm" onClick={() => setLoading(!loading)}>
            {loading ? "Show rows" : "Show loading"}
          </Button>
        }
      />
      <FilterBar
        label="Filter deployments"
        isFiltered={query !== "" || mine}
        onReset={() => {
          setQuery("")
          setMine(false)
        }}
      >
        <FilterBarSearch
          label="Search deployments"
          placeholder="Search deployments"
          value={query}
          onValueChange={setQuery}
        />
        <FilterBarButton aria-pressed={mine} onClick={() => setMine(!mine)}>
          Only eu-west
        </FilterBarButton>
      </FilterBar>
      <DataTable
        label="Deployments"
        rows={rows}
        columns={columns}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.project}
        selectable
        pageSize={5}
        loading={loading}
        empty={<p className="text-sm text-muted-foreground">No deployments match these filters.</p>}
      />
    </div>
  )
}

function DataSection() {
  return (
    <>
      <Section
        title="Data table"
        description="DataTable with PageHeader and FilterBar. Agents can sort, select and page it."
      >
        <DeploymentsDemo />
      </Section>

      <Section
        title="Sidebar"
        description="Navigation landmark, current page, icon rail with tooltips, a drawer on narrow screens."
      >
        <div className="flex h-72 w-full overflow-hidden rounded-surface border">
          <Sidebar label="Workspace navigation" header={<span className="px-2 text-sm font-semibold">Acme</span>}>
            <SidebarGroup label="Workspace">
              <SidebarItem href="#overview" icon={<Glyph d="M3 12 12 4l9 8M5 10v10h14V10" />} current>
                Overview
              </SidebarItem>
              <SidebarItem href="#deployments" icon={<Glyph d="M12 3v12m0 0-4-4m4 4 4-4M4 21h16" />} badge="23">
                Deployments
              </SidebarItem>
            </SidebarGroup>
            <SidebarGroup label="Account">
              <SidebarItem href="#settings" icon={<Glyph d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />}>
                Settings
              </SidebarItem>
            </SidebarGroup>
          </Sidebar>
          <div className="flex-1 p-surface text-sm text-muted-foreground">Page content</div>
        </div>
      </Section>

      <Section
        title="Resizable"
        description="Separator handles that move with the pointer or arrow keys; Enter collapses Files."
      >
        <div className="h-48 w-full overflow-hidden rounded-surface border">
          <Resizable>
            <ResizablePanel defaultSize={30} minSize={20} collapsible>
              <div className="p-4 text-sm">Files</div>
            </ResizablePanel>
            <ResizableHandle aria-label="Resize files" withGrip />
            <ResizablePanel>
              <div className="p-4 text-sm">Editor</div>
            </ResizablePanel>
          </Resizable>
        </div>
      </Section>

      <Section title="Calendar and DatePicker" description="ISO values, locale formats and a calendar popup.">
        <Calendar mode="range" defaultValue={["2026-11-09", "2026-11-13"]} locale="en-US" />
        <div className="flex w-full max-w-xs flex-col gap-4">
          <DatePicker label="Due date" defaultValue="2026-11-20" clearable />
          <DatePicker mode="range" labels={{ start: "Check in", end: "Check out" }} />
        </div>
      </Section>

      <Section title="Carousel" description="Native scrolling slides with Previous, Next, arrow keys and indicators.">
        <Carousel aria-label="Featured projects" className="w-full max-w-md">
          <CarouselViewport>
            <CarouselContent>
              {["Apollo", "Borealis", "Cygnus", "Draco"].map((name) => (
                <CarouselItem key={name}>
                  <div className="flex h-32 items-center justify-center rounded-surface bg-muted text-lg font-medium">
                    {name}
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
          </CarouselViewport>
          <div className="flex items-center justify-between">
            <CarouselPrevious />
            <CarouselIndicatorGroup aria-label="Choose a project">
              {[1, 2, 3, 4].map((page) => (
                <CarouselIndicator key={page} page={page} />
              ))}
            </CarouselIndicatorGroup>
            <CarouselNext />
          </div>
        </Carousel>
      </Section>
    </>
  )
}

export { DataSection }
