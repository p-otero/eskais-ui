import { usePreference } from "@ui-sdk/react/preferences"
import { lazy, Suspense, useState } from "react"
import { z } from "zod"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Bento, BentoTile } from "@/components/ui/bento"
import { Field, FieldLabel } from "@/components/ui/field"
import { Form, FormActions, FormField } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { IconTile, List, ListItem } from "@/components/ui/list-item"
import { Radio, RadioGroup, RadioIndicator } from "@/components/ui/radio-group"
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@/components/ui/segmented-control"
import { SectionHeading } from "@/components/ui/section-heading"
import { Select } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { StageTrack, type Stage } from "@/components/ui/stage-track"
import { StatusDot, StatusPill } from "@/components/ui/status-pill"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/components/ui/toast"
import { tones, type Tone } from "@/lib/tone"
import { cn } from "@/lib/utils"

import { agent } from "../agent"
import { appearance, palettes, themes, type Palette, type Theme } from "../appearance"

const LiveEditor = lazy(() => import("./live-editor"))
const LiveChart = lazy(() => import("./live-chart"))

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

function ThemeCard() {
  const theme = usePreference(appearance.theme).value
  const palette = usePreference(appearance.palette).value
  const dark = usePreference(appearance.colorScheme).resolved === "dark"
  return (
    <BentoTile
      eyebrow="Runtime themes"
      title="One set of tokens, many looks"
      description="Density, glass, palettes and dark mode switch at runtime with attributes on <html>. This changes the whole page."
      span={3}
    >
      <Field>
        <FieldLabel>Theme</FieldLabel>
        <SegmentedControl<Theme> value={theme} onValueChange={(next) => next && appearance.theme.set(next)}>
          <SegmentedControlIndicator />
          {themes.map((name) => (
            <SegmentedControlItem key={name} value={name}>
              {capitalize(name)}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      </Field>
      <Field>
        <FieldLabel>Palette</FieldLabel>
        <RadioGroup<Palette>
          value={palette}
          onValueChange={(next) => appearance.palette.set(next as Palette)}
          className="flex flex-row flex-wrap gap-x-group gap-y-items"
        >
          {palettes.map((name) => (
            <Label key={name}>
              <Radio value={name}>
                <RadioIndicator />
              </Radio>
              <span data-palette={name} className="flex items-center gap-inline">
                <span className="size-3 rounded-full bg-primary ring-1 ring-border" aria-hidden="true" />
                {capitalize(name)}
              </span>
            </Label>
          ))}
        </RadioGroup>
      </Field>
      <Field>
        <Switch checked={dark} onCheckedChange={(next) => appearance.colorScheme.set(next ? "dark" : "light")} />
        <FieldLabel>Dark mode</FieldLabel>
      </Field>
      <div className="mt-auto flex flex-wrap items-center gap-items rounded-surface border border-dashed px-inset-item py-inset-item">
        <Button size="sm">Deploy</Button>
        <Button size="sm" variant="outline">
          Preview
        </Button>
        <Badge tone="success">Ready</Badge>
        <StatusPill tone="info" dot pulse>
          Running
        </StatusPill>
      </div>
    </BentoTile>
  )
}

type Step = { id: number; text: string; tone: Tone }

function AgentCard() {
  const [steps, setSteps] = useState<Step[]>([])
  const [archived, setArchived] = useState(false)
  const log = (text: string, tone: Tone = "neutral") =>
    setSteps((list) => [...list, { id: list.length + 1, text, tone }])

  async function runAgent() {
    setSteps([])
    setArchived(false)
    const seen = agent
      .snapshot()
      .filter((entry) => entry.label === "Workspace name" || entry.label === "Archive workspace")
    log(`Reads the page: finds ${seen.map((entry) => `${entry.component} "${entry.label}"`).join(" and ")}.`)
    const rename = await agent.act({ steps: [{ ref: "Workspace name", action: "setValue", args: ["Apollo (old)"] }] })
    log(rename.ok ? 'Sets Workspace name to "Apollo (old)".' : `Couldn't rename: ${rename.error?.message}`, "info")
    log("Presses Archive workspace. It carries data-agent-confirm, so it asks you first.", "warning")
    const press = await agent.act({ steps: [{ ref: "Archive workspace", action: "press" }] })
    if (press.ok) log("You approved: the workspace is archived.", "success")
    else log(`You denied it: ${press.error?.message ?? "refused"}.`, "destructive")
  }

  return (
    <BentoTile
      eyebrow="Agents, with approval"
      title="Agents operate the UI. People approve."
      description="An agent reads the same parts a person uses, by their accessible names. Destructive actions carry data-agent-confirm and wait for you."
      span={3}
    >
      <div className="flex flex-col gap-items rounded-surface border bg-background px-inset-item py-inset-item">
        <Field>
          <FieldLabel>Workspace name</FieldLabel>
          <Input defaultValue="Apollo" />
        </Field>
        <div className="flex flex-wrap items-center gap-items">
          <Button
            variant="destructive"
            size="sm"
            data-agent-confirm="Archives the Apollo workspace for everyone"
            onClick={() => {
              setArchived(true)
              toast.success("Workspace archived")
            }}
          >
            Archive workspace
          </Button>
          {archived && <Badge tone="neutral">Archived</Badge>}
        </div>
      </div>
      <Button variant="outline" onClick={runAgent} pendingAnnouncement="The agent is working">
        Let the agent do it
      </Button>
      <ol aria-label="Agent steps" aria-live="polite" className="flex flex-col gap-inline text-body-sm">
        {steps.length === 0 && <li className="text-muted-foreground">The agent's steps show up here.</li>}
        {steps.map((step) => (
          <li key={step.id} className="flex items-start gap-inline">
            <StatusDot tone={step.tone} label={step.tone} className="mt-1.5" />
            <span>{step.text}</span>
          </li>
        ))}
      </ol>
    </BentoTile>
  )
}

const teamSchema = z.object({
  name: z.string().min(2),
  role: z
    .string()
    .nullable()
    .refine((value) => value !== null, "Choose a role."),
})

const roles = [
  { value: "admin", label: "Admin" },
  { value: "member", label: "Member" },
  { value: "viewer", label: "Viewer" },
]

const lineCounts = [
  { label: "Form and FormField", lines: 49, className: "w-2/5 bg-primary" },
  { label: "react-hook-form by hand", lines: 123, className: "w-full bg-series-remaining" },
]

function FormsCard() {
  return (
    <BentoTile
      eyebrow="Forms"
      title="Validation, errors and focus in 49 lines"
      description="Form on react-hook-form with any Standard Schema. Controls bind by name, server errors land on their fields, focus goes to the first problem."
      span={4}
    >
      <div className="grid grid-cols-2 gap-group max-md:grid-cols-1">
        <Form
          schema={teamSchema}
          defaultValues={{ name: "", role: null }}
          label="Invite a teammate"
          onSubmit={async (values) => {
            await new Promise((resolve) => setTimeout(resolve, 600))
            toast.success(`Invited ${values.name}`)
          }}
        >
          <FormField name="name" label="Name" required>
            <Input placeholder="Grace Hopper" />
          </FormField>
          <FormField name="role" label="Role" required>
            <Select options={roles} placeholder="Choose a role" />
          </FormField>
          <FormActions submitLabel="Invite" pendingLabel="Sending the invite" />
        </Form>
        <div className="flex flex-col justify-center gap-group">
          <p className="text-body-sm text-muted-foreground">
            The same invite form, with labels, descriptions, errors, pending state and focus management:
          </p>
          {lineCounts.map((row) => (
            <div key={row.label} className="flex flex-col gap-inline">
              <div className="flex items-baseline justify-between gap-items text-body-sm">
                <span>{row.label}</span>
                <span className="font-mono text-caption">{row.lines} lines</span>
              </div>
              <div className="h-2 rounded-full bg-muted" aria-hidden="true">
                <div className={cn("h-full rounded-full", row.className)} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </BentoTile>
  )
}

const toneMeaning: Record<Tone, string> = {
  neutral: "Draft, queued",
  info: "In progress",
  success: "Done, healthy",
  warning: "Needs attention",
  destructive: "Failed, blocked",
  violet: "A category",
}

function ToneCard() {
  return (
    <BentoTile
      eyebrow="Tone"
      title="Six words for status"
      description="Badge, Alert, StatusPill, Progress and Toast share one vocabulary, each with soft fills that hold 4.5:1."
      span={2}
    >
      <ul className="flex flex-col gap-inline">
        {tones.map((tone) => (
          <li key={tone} className="flex items-center justify-between gap-items">
            <Badge tone={tone}>{tone}</Badge>
            <span className="text-caption text-muted-foreground">{toneMeaning[tone]}</span>
          </li>
        ))}
      </ul>
    </BentoTile>
  )
}

function EditorCard() {
  return (
    <BentoTile
      eyebrow="Editor"
      title="Markdown, live"
      description="CodeMirror 6 with a Typora-like preview: marks show only while the caret is inside them. The value stays plain Markdown."
      span={3}
    >
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <LiveEditor />
      </Suspense>
    </BentoTile>
  )
}

function ChartCard() {
  return (
    <BentoTile
      eyebrow="Charts"
      title="Recharts on theme tokens"
      description="Series colours follow the palette and mode, meaningful series use their own tokens, and every chart has a data table."
      span={3}
    >
      <Suspense fallback={<Skeleton className="h-56 w-full" />}>
        <LiveChart />
      </Suspense>
    </BentoTile>
  )
}

const pipeline: Stage[] = [
  { id: "branch", label: "Branch" },
  { id: "pr", label: "Pull request" },
  { id: "dev", label: "In Dev", tone: "info" },
  { id: "staging", label: "In Staging", tone: "warning" },
  { id: "prod", label: "In Prod", tone: "success" },
]

const changes = [
  { id: "ENG-412", title: "Retry webhook deliveries with backoff", stage: "prod", tone: "success" as Tone },
  { id: "ENG-398", title: "Paginate the audit log export", stage: "staging", tone: "warning" as Tone },
  { id: "ENG-371", title: "Show seat usage on the billing page", stage: "dev", tone: "info" as Tone },
]

function PipelineIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="M6 8.5v3a4 4 0 0 0 4 4h5.5" />
    </svg>
  )
}

function PipelineCard() {
  const [selected, setSelected] = useState("ENG-398")
  const current = changes.find((change) => change.id === selected) ?? changes[0]!
  return (
    <BentoTile
      eyebrow="StageTrack + ListItem"
      title="Where every change is"
      description="Dense rows that select with one tab stop, and a pipeline whose markers never rely on colour alone."
      span={6}
    >
      <div className="grid grid-cols-2 items-start gap-section max-lg:grid-cols-1">
        <List aria-label="Changes">
          {changes.map((change) => (
            <ListItem
              key={change.id}
              id={change.id}
              title={change.title}
              leading={
                <IconTile tone={change.tone}>
                  <PipelineIcon />
                </IconTile>
              }
              subtitle={<span className="font-mono">{change.id}</span>}
              status={
                <StageTrack
                  aria-label={`Stage of ${change.title}`}
                  stages={pipeline}
                  current={change.stage}
                  variant="pill"
                />
              }
              selected={selected === change.id}
              onSelect={() => setSelected(change.id)}
            />
          ))}
        </List>
        <div className="flex min-w-0 flex-col gap-group rounded-surface border bg-background p-inset-surface">
          <p className="text-title-sm">{current.title}</p>
          <StageTrack aria-label={`Pipeline of ${current.title}`} stages={pipeline} current={current.stage} />
        </div>
      </div>
    </BentoTile>
  )
}

function Features() {
  return (
    <section aria-labelledby="features-title" className="flex flex-col gap-section py-section">
      <SectionHeading
        headingId="features-title"
        eyebrow="Live, not screenshots"
        title="Every tile below is the registry, running."
      />
      <Bento columns={6}>
        <ThemeCard />
        <AgentCard />
        <FormsCard />
        <ToneCard />
        <EditorCard />
        <ChartCard />
        <PipelineCard />
      </Bento>
    </section>
  )
}

export { Features }
