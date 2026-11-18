import {
  AppWindowIcon,
  ArrowLeftIcon,
  ArrowLeftRightIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  BoldIcon,
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsUpDownIcon,
  ChevronUpIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleDotIcon,
  CircleExclamationPointIcon,
  CircleMinusIcon,
  CirclePlusIcon,
  ClockIcon,
  CodeIcon,
  CopyIcon,
  EllipsisIcon,
  ExternalLinkIcon,
  EyeIcon,
  FileIcon,
  GitBranchIcon,
  GitCommitHorizontalIcon,
  GitPullRequestIcon,
  HeadingIcon,
  InfoIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  ListTodoIcon,
  MenuIcon,
  MinusIcon,
  PanelLeftIcon,
  PaperclipIcon,
  PlusIcon,
  SearchIcon,
  StrikethroughIcon,
  TextQuoteIcon,
  TrashIcon,
  TriangleExclamationPointIcon,
  XIcon,
  ZapIcon,
  ZoomInIcon,
  type LucideIcon,
} from "lucide-react"
import { useState } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CodeBlock } from "@/components/ui/code-block"
import { Icon } from "@/components/ui/icon"
import { SearchField } from "@/components/ui/search-field"
import { toast } from "@/components/ui/toast"
import { Toggle } from "@/components/ui/toggle"
import { ToggleGroup } from "@/components/ui/toggle-group"

import { A, Article, Code, DocTable, DocTitle, H2, P, Pre, Ul } from "../docs/prose"

/** The icons the registry's components import, by the name to import. */
const gallery: [name: string, icon: LucideIcon, usedBy: string][] = [
  ["ChevronDownIcon", ChevronDownIcon, "Select, Accordion, Collapsible, NavigationMenu"],
  ["ChevronUpIcon", ChevronUpIcon, "DataTable sort"],
  ["ChevronLeftIcon", ChevronLeftIcon, "Calendar, Carousel, Pagination, Lightbox"],
  ["ChevronRightIcon", ChevronRightIcon, "Breadcrumb, Calendar, Carousel, Pagination"],
  ["ChevronsUpDownIcon", ChevronsUpDownIcon, "DataTable sort"],
  ["ArrowLeftIcon", ArrowLeftIcon, "DocsPager"],
  ["ArrowRightIcon", ArrowRightIcon, "DocsPager"],
  ["ArrowUpRightIcon", ArrowUpRightIcon, "Link external"],
  ["ArrowLeftRightIcon", ArrowLeftRightIcon, "AgentBadge"],
  ["CheckIcon", CheckIcon, "Checkbox, Select, menus, CodeBlock"],
  ["XIcon", XIcon, "Input clear, Toast, Sidebar, Lightbox"],
  ["PlusIcon", PlusIcon, "NumberInput"],
  ["MinusIcon", MinusIcon, "NumberInput, Checkbox"],
  ["CirclePlusIcon", CirclePlusIcon, "BoardColumn"],
  ["CircleMinusIcon", CircleMinusIcon, "BoardColumn"],
  ["SearchIcon", SearchIcon, "SearchField, Command, FilterBar"],
  ["CopyIcon", CopyIcon, "CodeBlock"],
  ["ExternalLinkIcon", ExternalLinkIcon, "Lightbox, TaskLinks"],
  ["LinkIcon", LinkIcon, "MarkdownEditor"],
  ["ZoomInIcon", ZoomInIcon, "Lightbox"],
  ["InfoIcon", InfoIcon, "Toast info"],
  ["CircleCheckIcon", CircleCheckIcon, "Toast success"],
  ["TriangleExclamationPointIcon", TriangleExclamationPointIcon, "Toast warning, TaskCard"],
  ["CircleExclamationPointIcon", CircleExclamationPointIcon, "Toast error, ErrorState, FormActions"],
  ["CircleDashedIcon", CircleDashedIcon, "AcceptanceList"],
  ["CircleDotIcon", CircleDotIcon, "TaskLinks issue"],
  ["MenuIcon", MenuIcon, "SiteHeader"],
  ["PanelLeftIcon", PanelLeftIcon, "Sidebar"],
  ["EllipsisIcon", EllipsisIcon, "MobileNav, MarkdownEditor"],
  ["AppWindowIcon", AppWindowIcon, "AttemptTimeline"],
  ["FileIcon", FileIcon, "Attachments"],
  ["PaperclipIcon", PaperclipIcon, "TaskCard"],
  ["CalendarIcon", CalendarIcon, "DatePicker"],
  ["ClockIcon", ClockIcon, "AgentTaskBoard"],
  ["EyeIcon", EyeIcon, "TaskCard"],
  ["ZapIcon", ZapIcon, "TaskCard"],
  ["GitBranchIcon", GitBranchIcon, "TaskLinks"],
  ["GitCommitHorizontalIcon", GitCommitHorizontalIcon, "TaskLinks"],
  ["GitPullRequestIcon", GitPullRequestIcon, "TaskLinks"],
  ["HeadingIcon", HeadingIcon, "MarkdownEditor"],
  ["BoldIcon", BoldIcon, "MarkdownEditor"],
  ["ItalicIcon", ItalicIcon, "MarkdownEditor"],
  ["StrikethroughIcon", StrikethroughIcon, "MarkdownEditor"],
  ["CodeIcon", CodeIcon, "MarkdownEditor"],
  ["TextQuoteIcon", TextQuoteIcon, "MarkdownEditor"],
  ["ListIcon", ListIcon, "MarkdownEditor"],
  ["ListOrderedIcon", ListOrderedIcon, "MarkdownEditor"],
  ["ListTodoIcon", ListTodoIcon, "MarkdownEditor"],
]

function Gallery() {
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState("ChevronDownIcon")
  const terms = query.trim().toLowerCase()
  const shown = gallery.filter(
    ([name, , usedBy]) => !terms || name.toLowerCase().includes(terms) || usedBy.toLowerCase().includes(terms),
  )
  const usedBy = gallery.find(([name]) => name === selected)?.[2]
  return (
    <div className="flex flex-col gap-group">
      <SearchField label="Filter icons" placeholder="Filter by name or component" onValueChange={setQuery} />
      <CodeBlock
        code={`import { ${selected} } from "lucide-react"`}
        language="ts"
        title={usedBy ? `Used by ${usedBy}` : undefined}
      />
      {shown.length === 0 ? (
        <p className="text-body-sm text-muted-foreground">
          No icon the registry uses matches. Lucide has more than 1,600: search them on lucide.dev.
        </p>
      ) : (
        <ToggleGroup
          aria-label="Icons"
          value={[selected]}
          onValueChange={(next) => next[0] && setSelected(next[0])}
          className="grid w-full grid-cols-2 gap-items sm:grid-cols-3 lg:grid-cols-4"
        >
          {shown.map(([name, Glyph]) => (
            <Toggle
              key={name}
              value={name}
              variant="outline"
              className="h-auto min-w-0 flex-col gap-inline px-inset-item py-inset-item [&_svg]:size-5"
            >
              <Glyph />
              <span className="w-full truncate font-mono text-caption">{name.replace(/Icon$/, "")}</span>
            </Toggle>
          ))}
        </ToggleGroup>
      )}
    </div>
  )
}

const install = `npm install lucide-react
npx shadcn@latest add @eskais/icon`

const importByName = `import { ChevronDownIcon, TrashIcon } from "lucide-react"

<Button variant="outline">
  <TrashIcon />
  Delete
</Button>`

const meaningful = `import { TriangleExclamationPointIcon } from "lucide-react"

import { Icon } from "@/components/ui/icon"

// Decorative: the text says it all, and lucide sets aria-hidden on its own.
<span><TriangleExclamationPointIcon className="size-4" /> Blocked</span>

// Meaningful: nothing else says "Blocked", so the icon carries the name.
<Icon icon={TriangleExclamationPointIcon} label="Blocked" className="size-4 text-destructive" />

// An icon-only button is named by the button, not the icon.
<Button size="icon" aria-label="Delete"><TrashIcon /></Button>`

const swap = `- import { ChevronDownIcon } from "lucide-react"
+ import { ChevronDownIcon } from "@/components/icons"`

const ownIcon = `import type { SVGAttributes } from "react"

export function RocketIcon(props: SVGAttributes<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M5 19c1-3 3-5 6-6M14 4c3 0 6 3 6 6l-7 7-6-6Z" />
    </svg>
  )
}

<Icon icon={RocketIcon} label="Launched" />`

const tones = [
  ["text-muted-foreground", "size-4 text-muted-foreground", CircleDashedIcon],
  ["text-info", "size-4 text-info", InfoIcon],
  ["text-success", "size-4 text-success", CircleCheckIcon],
  ["text-warning", "size-4 text-warning", TriangleExclamationPointIcon],
  ["text-destructive", "size-4 text-destructive", CircleExclamationPointIcon],
] as const

export default function Icons() {
  return (
    <Article>
      <DocTitle
        eyebrow="Getting started"
        title="Icons"
        description="Components draw their icons with lucide-react, imported by name the way shadcn does. Icon names one for screen readers when it carries meaning."
      />

      <H2 id="install">Install</H2>
      <P>
        Every item that shows an icon lists <Code>lucide-react</Code> as a dependency, without a version, so shadcn
        installs the latest release in a project that doesn't have it and leaves the one you have alone. The icons need
        1.68.0 or newer: upgrade an older one. Add it yourself to use icons in your own code, and add <Code>icon</Code>{" "}
        for named icons:
      </P>
      <Pre code={install} language="bash" />

      <H2 id="import">Import by name</H2>
      <P>
        Import each icon by its name from <Code>lucide-react</Code>; your bundler keeps only the ones you use. Browse
        the whole set on <A href="https://lucide.dev/icons">lucide.dev</A>.
      </P>
      <Pre code={importByName} />

      <H2 id="gallery">The icons the registry uses</H2>
      <P>Pick one to see its import, ready to copy.</P>
      <Gallery />

      <H2 id="meaning">Decorative or meaningful</H2>
      <Ul>
        <li>
          Lucide sets <Code>aria-hidden</Code> on an icon that has no <Code>aria-*</Code>, <Code>role</Code> or{" "}
          <Code>title</Code> prop, so a decorative icon next to text needs nothing. It is hidden from agents too.
        </li>
        <li>
          When the icon is the only sign of what it means, wrap it: <Code>{`<Icon icon={XIcon} label="…" />`}</Code>{" "}
          renders <Code>role="img"</Code> with that <Code>aria-label</Code>, in the page's language.
        </li>
        <li>
          An icon-only button is named by the button (<Code>aria-label</Code>), and its icon stays decorative.
        </li>
      </Ul>
      <Pre code={meaningful} />
      <div className="flex flex-wrap items-center gap-group rounded-surface border px-inset-item py-inset-item">
        <span className="flex items-center gap-inline text-body">
          <TriangleExclamationPointIcon className="size-4 text-destructive" />
          Blocked
        </span>
        <Icon icon={TriangleExclamationPointIcon} label="Blocked" className="size-4 text-destructive" />
        <Button size="icon" variant="outline" aria-label="Delete">
          <TrashIcon />
        </Button>
      </div>

      <H2 id="size">Size</H2>
      <P>
        Controls size their icons: Button, Toggle, menu items, inputs and selects set <Code>[&_svg]:size-4</Code>, Badge{" "}
        <Code>size-3</Code>. Those classes win over lucide's <Code>size</Code> prop. Anywhere else, give the icon a{" "}
        <Code>size-*</Code> class that matches the text beside it; an icon nothing sizes is 24px.
      </P>
      <DocTable
        label="Icon sizes"
        head={["Class", "Beside", "Looks"]}
        rows={[
          [
            <Code key="c">size-3.5</Code>,
            <>
              <Code>text-caption</Code>, <Code>text-body-sm</Code>
            </>,
            <span key="l" className="flex items-center gap-inline text-body-sm">
              <ClockIcon className="size-3.5" /> 2 min ago
            </span>,
          ],
          [
            <Code key="c">size-4</Code>,
            <Code key="b">text-body</Code>,
            <span key="l" className="flex items-center gap-inline text-body">
              <FileIcon className="size-4" /> report.pdf
            </span>,
          ],
          [
            <Code key="c">size-5</Code>,
            <>
              <Code>text-title-sm</Code>, <Code>text-title</Code>
            </>,
            <span key="l" className="flex items-center gap-inline text-title-sm">
              <CalendarIcon className="size-5" /> This week
            </span>,
          ],
        ]}
      />
      <P>
        Keep lucide's stroke of 2. A tick inside a small indicator (Checkbox, Select) takes{" "}
        <Code>strokeWidth={"{2.5}"}</Code> or <Code>{"{3}"}</Code> to stay legible. Mirror icons that point a direction
        with <Code>rtl:-scale-x-100</Code>.
      </P>

      <H2 id="colour">Colour</H2>
      <P>
        Icons stroke with <Code>currentColor</Code>, so a text colour colours them. For status, use the tone's text
        colour, and still say the status in words.
      </P>
      <ul aria-label="Icons in tone colours" className="flex flex-wrap gap-group">
        {tones.map(([utility, className, Glyph]) => (
          <li key={utility} className="flex items-center gap-inline text-body-sm">
            <Glyph className={className} />
            <Code>{utility}</Code>
          </li>
        ))}
      </ul>

      <H2 id="components">In components</H2>
      <P>
        Put the icon first in a Button or Badge, before the text; the component spaces and sizes it. An Alert takes an
        icon as its first child and colours it with its tone. Toasts draw their tone's icon on their own.
      </P>
      <div className="flex flex-col gap-items">
        <div className="flex flex-wrap items-center gap-items">
          <Button>
            <PlusIcon />
            New project
          </Button>
          <Button variant="outline" onClick={() => toast.success("Copied the link")}>
            <CopyIcon />
            Show a toast
          </Button>
          <Badge tone="success">
            <CheckIcon />
            Passed
          </Badge>
          <Badge tone="warning">
            <ClockIcon />
            Waiting
          </Badge>
        </div>
        <Alert tone="warning">
          <TriangleExclamationPointIcon />
          <AlertTitle>Quota almost used</AlertTitle>
          <AlertDescription>New runs pause at 100%.</AlertDescription>
        </Alert>
      </div>

      <H2 id="swap">Swap the icon library</H2>
      <P>
        The components import icons by name from <Code>lucide-react</Code> and nothing else depends on the library: only
        the import lines change. Point them at a module that exports the same names from another set, or your own
        drawings, and <Code>Icon</Code> takes any SVG component.
      </P>
      <Pre code={swap} language="diff" />

      <H2 id="own">Add your own icon</H2>
      <P>
        Draw it to lucide's grid so it sits with the rest: a 24×24 view box, a 2px stroke with round caps and joins,{" "}
        <Code>fill="none"</Code> and <Code>currentColor</Code>, decorative by default, passing its props to the{" "}
        <Code>{"<svg>"}</Code>. In the registry and on this site, the <Code>eskais/no-inline-icons</Code> lint rule
        flags any <Code>{"<svg>"}</Code>; only drawings that aren't icons, like the spinner or a logo, disable it with a
        reason.
      </P>
      <Pre code={ownIcon} />
    </Article>
  )
}
