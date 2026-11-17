// Code shown on the Mockups guide. The outputs are copied from real runs of the CLI.
const quickstart = `git clone --depth 1 https://github.com/p-otero/eskais-ui
npx shadcn@latest init -t vite -n app -b base -p nova --no-monorepo
cd app && npx shadcn@latest registry add "@eskais=https://raw.githubusercontent.com/p-otero/eskais-ui/main/public/r/{name}.json"
npx shadcn@latest add @eskais/theme @eskais/card @eskais/button --overwrite -y
# write .mockups/hello/screen.tsx (below), then:
bun ../eskais-ui/packages/mockup/src/cli.ts validate hello`

const helloScreen = `import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function Hello() {
  return (
    <main className="flex flex-col gap-section p-inset-surface font-sans">
      <Card>
        <CardHeader>
          <CardTitle>Atlas workspace</CardTitle>
          <CardDescription>3 members · Team plan</CardDescription>
        </CardHeader>
        <CardContent>
          <Button>Invite people</Button>
        </CardContent>
      </Card>
    </main>
  )
}`

const helloOutput = `ok .mockups/hello/out.html  460 kB (282 kB js, 177 kB css, 75 kB fonts)
install none
proposed none
sdkParts none
gaps none`

const agentPrompt = `Make a mockup of a Team settings screen: the members with their role, a way to
remove one, an Invite button, and a place to drop a team logo. Validate it and
tell me what it would take to build.`

const checkoutCommands = `# from your project, with the checkout next to it
bun ../eskais-ui/packages/mockup/src/cli.ts inspect
bun ../eskais-ui/packages/mockup/src/cli.ts validate team`

const linkCommands = `# once, in the checkout: registers @eskais/mockup with Bun
(cd ../eskais-ui/packages/mockup && bun link)
# in the project: adds node_modules/.bin/eskais-mockup
bun link @eskais/mockup
bunx eskais-mockup validate team`

const levelOne = `import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"`

const levelTwo = `import { Badge } from "@registry/badge" // not installed: fetched into .mockups/.registry/<ref>/`

const levelThree = `// .mockups/team/parts/member-row.tsx
import { Badge } from "@registry/badge"
import { Button } from "@/components/ui/button"

import type { Member } from "../fixtures"

export type MemberRowProps = { member: Member; onRemove?: (id: string) => void }

export function MemberRow({ member, onRemove }: MemberRowProps) {
  return (
    <li className="flex items-center justify-between gap-items py-inset-item">
      <span className="flex items-center gap-inline text-body">
        {member.name}
        <Badge variant="secondary">{member.role}</Badge>
      </span>
      <Button variant="ghost" size="sm" onClick={() => onRemove?.(member.id)}>
        Remove {member.name}
      </Button>
    </li>
  )
}`

const levelFour = `// .mockups/team/parts/avatar-drop.tsx
import { FileInput, FileInputDropzone, FileInputTrigger } from "@ui-sdk/react/file-input"

import { buttonVariants } from "@/components/ui/button"

// sdk-reason: Eskais has no file input; UI SDK's FileInput gives the dropzone, the picker and the agent actions
export function AvatarDrop() {
  return (
    <FileInput accept="image/*">
      <FileInputDropzone className="flex flex-col items-center gap-items rounded-surface border border-dashed border-input-strong p-inset-surface text-body-sm text-muted-foreground">
        Drop a team logo here
        <FileInputTrigger className={buttonVariants({ variant: "outline", size: "sm" })}>Choose a file</FileInputTrigger>
      </FileInputDropzone>
    </FileInput>
  )
}`

const levelFive = `// .mockups/team/gaps.ts
export const gaps = [
  {
    component: "Button",
    missing: "a split button with a menu of roles",
    reason: "Invite needs a default role and a menu of the others; no Eskais part or composition gives one control",
  },
]`

const inspectRegistry = `@eskais 0dc2acb842db  107 of 114 component items not installed  (.mockups/.registry/0dc2acb842db)
  acceptance-list          A list of pass, fail and unverified criteria with evidence, and a segmented AcceptanceBar on the UI SDK Meter…
  accordion                UI SDK Accordion parts: triggers in headings, Enter and Space toggle, animated panels on the density tokens.
  …`

const inspectSdk = `$ bun ../eskais-ui/packages/mockup/src/cli.ts inspect --sdk
@ui-sdk/react 0.1.0-beta.5  68 public subpaths
  accordion            Accordion, AccordionHeader, AccordionItem, AccordionPanel, …
  …
$ bun ../eskais-ui/packages/mockup/src/cli.ts inspect --sdk file-input
@ui-sdk/react/file-input  (node_modules/@ui-sdk/react/dist/file-input.d.ts)
import { FileInput, FileInputDropzone, FileInputItem, FileInputItemRemove, FileInputList, FileInputTrigger } from "@ui-sdk/react/file-input"
parts FileInput, FileInputDropzone, FileInputItem, FileInputItemRemove, FileInputList, FileInputTrigger`

const layout = `.mockups/
  .gitignore        # "*", written by build: mockups and the cache stay out of the repository
  .registry/<ref>/  # registry items fetched for @registry/ imports
  wrapper.tsx       # optional, shared: ({ children }) => providers
  team/
    screen.tsx      # default-exports the screen; data comes in as props
    fixtures.ts     # the types and a sample of the data
    parts/          # optional: components the screen proposes (levels 3 and 4)
    gaps.ts         # optional: what no level could give (level 5)
    manifest.json   # written by build
    out.html        # written by build: one offline file`

const screen = `import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { sampleMembers, type Member } from "./fixtures"
import { AvatarDrop } from "./parts/avatar-drop"
import { MemberRow } from "./parts/member-row"

export default function Team({ members = sampleMembers }: { members?: Member[] }) {
  const [list, setList] = useState(members)
  return (
    <main className="flex flex-col gap-section p-inset-surface font-sans">
      <Card>
        <CardHeader>
          <CardTitle>Team</CardTitle>
          <CardAction>
            <Button>Invite people</Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-group">
          <ul className="flex flex-col divide-y">
            {list.map((member) => (
              <MemberRow key={member.id} member={member} onRemove={(id) => setList((current) => current.filter((entry) => entry.id !== id))} />
            ))}
          </ul>
          <AvatarDrop />
        </CardContent>
      </Card>
    </main>
  )
}`

const validateOk = `$ bun ../eskais-ui/packages/mockup/src/cli.ts validate team
ok .mockups/team/out.html  485 kB (305 kB js, 179 kB css, 75 kB fonts)
install 2: badge, tone
proposed 2: AvatarDrop (0 props), MemberRow (2 props)
sdkParts 1: AvatarDrop ← @ui-sdk/react/file-input
gaps 1: Button (a split button with a menu of roles)`

const validateProblems = [
  "$ bun ../eskais-ui/packages/mockup/src/cli.ts validate broken",
  '.mockups/broken/parts/avatar-drop.tsx:1:1 sdk-reason add a line "// sdk-reason: <why Eskais cannot do this>" above the AvatarDrop component',
  ".mockups/broken/parts/avatar-drop.tsx:9:160 shadcn/no-raw-colors bg-white is a raw colour; use a theme token (bg-card, text-muted-foreground, border-input)",
  ".mockups/broken/parts/avatar-drop.tsx:9:169 shadcn/no-arbitrary-values w-[13px] is an arbitrary size; use the Tailwind scale or a theme token",
  ".mockups/broken/screen.tsx:32:11 bare-control a bare <button> is invisible to agents and unstyled; use the project's own control part",
  "install 2: badge, tone",
  "proposed 2: AvatarDrop (0 props), MemberRow (2 props)",
  "sdkParts none",
  "gaps 1: Button (a split button with a menu of roles)",
].join("\n")

export {
  agentPrompt,
  checkoutCommands,
  helloOutput,
  helloScreen,
  inspectRegistry,
  inspectSdk,
  layout,
  levelFive,
  levelFour,
  levelOne,
  levelThree,
  levelTwo,
  linkCommands,
  quickstart,
  screen,
  validateOk,
  validateProblems,
}
