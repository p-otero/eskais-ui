import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@ui-sdk/react/alert-dialog"
import { useRef, useState } from "react"

import { Appearance } from "@/components/ui/appearance"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardEyebrow,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  backdropClassName,
  contentClassName,
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input, InputClear, InputGroup } from "@/components/ui/input"
import { SearchField } from "@/components/ui/search-field"
import { SkipLink } from "@/components/ui/skip-link"
import { Spinner } from "@/components/ui/spinner"

import { agent, approval, type ApprovalRequest } from "./agent"
import { AppearanceControls, appearance, palettes } from "./appearance"
import { Section } from "./section"
import { BoardSection } from "./sections/board"
import { NavigationSection } from "./sections/navigation"
import { OverlaysSection } from "./sections/overlays"
import { DialogSizesSection } from "./sections/dialog-sizes"
import { PageSection, StatesSection } from "./sections/page"
import { FloatingSection } from "./sections/floating"
import { ProposalsSection } from "./sections/proposals"
import { StructureSection } from "./sections/structure"
import { SelectionSection } from "./sections/selection"
import { FormsSection } from "./sections/forms"
import { ValuesSection } from "./sections/values"
import { StatusSection } from "./sections/status"
import { AgentsSection } from "./sections/agents"
import { AttemptsSection } from "./sections/attempts"
import { AgentTaskBoardSection } from "./sections/agent-task-board"
import { DataSection } from "./sections/data"
import { ChartsSection } from "./sections/charts"
import { MarkdownSection } from "./sections/markdown"
import { AttachmentsSection, LightboxSection } from "./sections/media"
import { StagesSection } from "./sections/stages"
import { ListsSection } from "./sections/lists"
import { ThemeEditor } from "./theme-editor"

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function SearchDemo() {
  const [searches, setSearches] = useState<string[]>([])
  return (
    <div className="flex w-full max-w-md flex-col gap-2">
      <SearchField
        label="Search projects"
        placeholder="Search projects"
        onSearch={(query, details) => setSearches((list) => [`"${query}" (${details.source})`, ...list].slice(0, 3))}
      />
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {searches.length === 0 ? "Press Enter to search, Escape to clear." : `Searched ${searches.join(", ")}`}
      </p>
    </div>
  )
}

function LoadingButtons() {
  const [loading, setLoading] = useState(false)
  return (
    <>
      <Button variant="outline" aria-pressed={loading} onClick={() => setLoading(!loading)}>
        Simulate loading
      </Button>
      <Button loading={loading}>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" />
        </svg>
        Export
      </Button>
      <Button variant="secondary" loading={loading}>
        Publish
      </Button>
      <Button variant="ghost" size="icon" aria-label="Refresh" loading={loading}>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />
        </svg>
      </Button>
    </>
  )
}

function RenameDialog() {
  return (
    <Dialog>
      <DialogTrigger>Rename project</DialogTrigger>
      <DialogBackdrop />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Apollo</DialogTitle>
          <DialogDescription>Everyone on the team sees the new name.</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel>Project name</FieldLabel>
          <Input defaultValue="Apollo" />
        </Field>
        <DialogFooter>
          <DialogClose>Cancel</DialogClose>
          <DialogClose variant="default" value="save">
            Save
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DeleteProject() {
  const attempts = useRef(0)
  return (
    <ConfirmDialog
      trigger="Delete project"
      title="Delete Apollo?"
      description="The project, its files and its deployment history are deleted for everyone. The first attempt fails on purpose."
      confirmLabel="Delete forever"
      tone="destructive"
      agentConfirm="Deletes the Apollo project and its files"
      pendingAnnouncement="Deleting project"
      onConfirm={async () => {
        await wait(1200)
        if (attempts.current++ === 0) throw new Error("Couldn't delete the project. Try again.")
      }}
    />
  )
}

function AgentApproval() {
  return (
    <AlertDialog controller={approval.controller}>
      <AlertDialogBackdrop className={backdropClassName} />
      <AlertDialogContent<ApprovalRequest> className={contentClassName}>
        {(state) => (
          <>
            <div className="flex flex-col gap-1.5">
              <AlertDialogTitle className="text-lg leading-none font-semibold">Agent needs approval</AlertDialogTitle>
              <AlertDialogDescription className="text-sm text-muted-foreground">
                The agent wants to run: {state.payload?.sentence}
              </AlertDialogDescription>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <AlertDialogClose className={buttonVariants({ variant: "outline" })}>Deny</AlertDialogClose>
              <AlertDialogClose value="confirm" className={buttonVariants({ variant: "destructive" })}>
                Approve
              </AlertDialogClose>
            </div>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}

function AgentPanel() {
  const [output, setOutput] = useState("Run a step to see what the agent sees and does.")

  async function run(steps: Parameters<typeof agent.act>[0]["steps"]) {
    const result = await agent.act({ steps })
    setOutput(result.ok ? "ok" : `refused: ${result.error?.message ?? "unknown error"}`)
  }

  return (
    <Section
      title="Agent bridge"
      description="createAgent from @ui-sdk/react/agent reads and drives the components above. Destructive steps wait for a person."
    >
      <Button
        variant="secondary"
        onClick={() => {
          const entries = agent
            .snapshot()
            .filter((entry) => !entry.offPage)
            .map((entry) => ({ component: entry.component, label: entry.label, actions: entry.actions }))
          setOutput(JSON.stringify(entries, null, 2))
        }}
      >
        Read snapshot
      </Button>
      <Button
        variant="secondary"
        onClick={() =>
          run([
            { ref: "Search projects", action: "setValue", args: ["atlas"] },
            { ref: "Search projects", action: "submit" },
          ])
        }
      >
        Agent: search for atlas
      </Button>
      <Button
        variant="secondary"
        onClick={() => run([{ ref: "Delete project", action: "press", args: ["Delete forever"] }])}
      >
        Agent: delete Apollo
      </Button>
      <AgentApproval />
      <pre className="max-h-64 w-full overflow-auto rounded-md bg-muted p-3 text-xs" aria-label="Agent output">
        {output}
      </pre>
    </Section>
  )
}

function App() {
  return (
    <Appearance appearance={appearance}>
      <SkipLink>Skip to content</SkipLink>
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold">Eskais UI</h1>
            <p className="text-sm text-muted-foreground">UI SDK-first, agent-native components. v0.1 catalog.</p>
          </div>
          <AppearanceControls />
        </header>

        <main id="main" tabIndex={-1} className="flex flex-col gap-6 outline-none">
          <Section
            title="Theme"
            description="Seed tokens: pick a preset or a brand colour, tint the greys, set the radius, then copy the CSS."
          >
            <ThemeEditor appearance={appearance} palettes={palettes} />
          </Section>
          <Section
            title="Button"
            description="Variants, sizes, async pending, loading (the spinner replaces the leading icon, the width holds) and focusable-when-disabled."
          >
            <Button>Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="link">Link</Button>
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
            <Button onClick={() => wait(1500)} pendingAnnouncement="Saving">
              Save (async)
            </Button>
            <Button disabled focusableWhenDisabled>
              Unavailable
            </Button>
            <LoadingButtons />
          </Section>

          <Section
            title="Spinner"
            description="Sized like an icon, in currentColor. Decorative by default; a label makes it a status. Pulses under reduced motion."
          >
            <Spinner size="sm" />
            <Spinner />
            <Spinner size="lg" />
            <span className="inline-flex items-center gap-inline text-sm text-muted-foreground">
              <Spinner label="Syncing projects" />
              Syncing
            </span>
          </Section>

          <Section title="Input" description="Field wiring, input groups and a clear button that returns focus.">
            <div className="flex w-full flex-wrap items-start gap-3">
              <Field className="w-full max-w-xs">
                <FieldLabel>Email</FieldLabel>
                <Input type="email" required placeholder="ada@example.com" />
                <FieldDescription>We never share it.</FieldDescription>
                <FieldError match="valueMissing">Enter your email address.</FieldError>
              </Field>
              <Field className="w-full max-w-xs">
                <FieldLabel>Website</FieldLabel>
                <InputGroup>
                  <span className="text-muted-foreground">https://</span>
                  <Input defaultValue="eskais.dev" />
                  <InputClear aria-label="Clear website" />
                </InputGroup>
              </Field>
            </div>
          </Section>

          <Section
            title="SearchField"
            description="A custom primitive built with definePrimitive. Agents get a submit action."
          >
            <SearchDemo />
          </Section>

          <SelectionSection />

          <FormsSection />

          <Section title="Dialog" description="Focus trap, Escape, focus restore and an agent-editable field.">
            <RenameDialog />
          </Section>

          <Section
            title="ConfirmDialog"
            description="Async confirm: pending, no double submit, closes on success, inline error on failure."
          >
            <DeleteProject />
          </Section>

          <Section
            title="Card and Badge"
            description="A titled Card is a section named by its title. Eyebrow, action slot and heading level."
          >
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge tone="neutral">Draft</Badge>
            <Badge tone="success">Ready</Badge>
            <Badge tone="warning">Building</Badge>
            <Badge tone="info">Preview</Badge>
            <Badge tone="destructive">Failed</Badge>
            <Badge tone="violet">Design</Badge>
            <Card className="w-full max-w-sm">
              <CardHeader>
                <CardEyebrow>Project</CardEyebrow>
                <CardTitle headingLevel={3}>Apollo</CardTitle>
                <CardDescription>Last deployed 2 hours ago</CardDescription>
                <CardAction>
                  <Button size="sm" variant="ghost">
                    Share
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent>
                <Badge tone="success">Ready</Badge>
              </CardContent>
              <CardFooter>
                <Button size="sm" variant="outline">
                  Open
                </Button>
              </CardFooter>
            </Card>
          </Section>

          <PageSection />

          <StatesSection />

          <StructureSection />

          <OverlaysSection />

          <DialogSizesSection />

          <FloatingSection />

          <NavigationSection />

          <ValuesSection />

          <BoardSection />

          <AttemptsSection />

          <StatusSection />

          <AgentsSection />

          <ProposalsSection />

          <AgentTaskBoardSection />

          <DataSection />

          <ChartsSection />

          <MarkdownSection />
          <LightboxSection />

          <AttachmentsSection />

          <StagesSection />

          <ListsSection />

          <AgentPanel />
        </main>
      </div>
    </Appearance>
  )
}

export { App }
