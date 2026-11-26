import { spawn, spawnSync } from "node:child_process"
import { createReadStream, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { createServer } from "node:http"
import { tmpdir } from "node:os"
import { dirname, extname, join, normalize, resolve } from "node:path"

import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"

import { unversionedDependencies, youngDependencyExceptions } from "./check-dependency-age.mjs"

const pm = process.argv[2] ?? "npm"
if (pm !== "npm" && pm !== "pnpm" && pm !== "bun") throw new Error(`Unsupported package manager: ${pm}`)

const repo = resolve(import.meta.dirname, "..")
const registryDir = join(repo, "public", "r")
const allItems = [
  "link",
  "code-block",
  "diff",
  "diff-view",
  "text-diff",
  "git-diff",
  "hero",
  "landing-page",
  "utils",
  "tone",
  "test-utils",
  "theme",
  "theme-compact",
  "theme-glass",
  "theme-liquid",
  "liquid-lens",
  "palettes",
  "font-geist",
  "appearance",
  "spinner",
  "button",
  "field",
  "input",
  "search-field",
  "dialog",
  "confirm-dialog",
  "form",
  "form-dialog",
  "card",
  "section",
  "badge",
  "tabs",
  "collapsible",
  "scroll-area",
  "separator",
  "avatar",
  "skeleton",
  "empty",
  "states",
  "kbd",
  "table",
  "tooltip",
  "popover",
  "drawer",
  "dropdown-menu",
  "toast",
  "select",
  "native-select",
  "combobox",
  "segmented-control",
  "checkbox",
  "textarea",
  "token-input",
  "quantity",
  "relative-time",
  "acceptance-list",
  "stat",
  "description-list",
  "board",
  "status-pill",
  "agent-task-types",
  "dependency-chips",
  "agent-badge",
  "liveness-indicator",
  "task-status",
  "usage",
  "attempt-timeline",
  "agent-task-board-core",
  "proposal-actions",
  "radio-group",
  "switch",
  "slider",
  "toggle",
  "toggle-group",
  "otp-input",
  "number-input",
  "label",
  "progress",
  "meter",
  "alert",
  "task-card",
  "task-detail-panel",
  "agent-task-board",
  "accordion",
  "hover-card",
  "context-menu",
  "menubar",
  "navigation-menu",
  "breadcrumb",
  "pagination",
  "command",
  "calendar",
  "date-picker",
  "date-time-picker",
  "carousel",
  "resizable",
  "sidebar",
  "data-table",
  "skip-link",
  "site-header",
  "topbar",
  "mobile-nav",
  "page-layout",
  "page-header",
  "filter-bar",
  "chart",
  "markdown-view",
  "markdown-editor",
  "markdown-editor-languages",
  "lightbox",
  "attachments",
  "stage-track",
  "list-item",
  "shortcuts",
  "shortcuts-dialog",
  "row-navigation",
  "virtual-rows",
  "trail-rows",
  "commit-history",
  "git-tree",
  "side-panel",
  "inbox",
  "master-detail",
  "dashboard-grid",
  "settings-page",
  "shell",
  "document-workspace",
  "page-source",
  "filter-schema",
  "url-state",
  "url-param",
  "server-data",
  "server-data-table",
  "filter-search",
  "filter-field",
  "filter-chips",
  "filter-panel",
  "server-combobox",
  "server-list",
]
const versions = {
  react: "19.3.1",
  "react-dom": "19.3.1",
  "@types/react": "19.3.0",
  "@types/react-dom": "19.3.0",
  vite: "8.3.8",
  "@vitejs/plugin-react": "6.3.0",
  tailwindcss: "4.3.5",
  "@tailwindcss/vite": "4.3.5",
  typescript: "7.0.2",
  shadcn: "4.23.0",
  playwright: "1.65.0",
  "tw-animate-css": "1.4.0",
  cn: "0.5.2",
  prettier: "3.9.10",
  zod: "4.6.7",
  "lucide-react": "1.70.0",
}
const devDependencies = [
  "@types/react",
  "@types/react-dom",
  "vite",
  "@vitejs/plugin-react",
  "tailwindcss",
  "@tailwindcss/vite",
  "typescript",
  "shadcn",
  "playwright",
]
const pick = (names) => Object.fromEntries(names.map((name) => [name, versions[name]]))

const installedTypes = new Set(["registry:ui", "registry:lib", "registry:hook", "registry:component"])
const itemsWithCode = JSON.parse(readFileSync(join(repo, "registry.json"), "utf8"))
  .items.filter((item) => (item.files ?? []).some((file) => installedTypes.has(file.type)))
  .map((item) => item.name)

const server = createServer((request, response) => {
  const file = normalize(join(registryDir, decodeURIComponent(new URL(request.url, "http://x").pathname)))
  if (!file.startsWith(registryDir) || !existsSync(file)) {
    response.writeHead(404).end()
    return
  }
  response.writeHead(200, { "content-type": "application/json" })
  createReadStream(file).pipe(response)
})
await new Promise((ready) => server.listen(0, "127.0.0.1", ready))
const { port } = server.address()

const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2" }

const probes = `
function Probes() {
  return (
    <div>
      <div data-probe="dark" className="size-4 bg-background dark:bg-destructive" />
      <div data-probe="dark-reference" className="size-4 bg-destructive" />
      <p data-probe="cn" className={cn("text-meta", "text-muted-foreground")}>Meta</p>
      <span data-probe="token" className="border border-violet-border bg-violet-soft text-violet-soft-foreground">
        Violet
      </span>
      <span data-probe="token" className="border border-warning-border bg-warning-soft text-warning-soft-foreground">
        Warning
      </span>
      <div data-probe="token" className="h-4 bg-skeleton" />
      <a data-probe="link" href="#top" className="text-link underline">
        Link
      </a>
      <p className="text-body">
        <strong data-probe="bold" className="text-body">Strong</strong> <b data-probe="bold" className="text-caption">B</b>
      </p>
      <table>
        <thead>
          <tr>
            <th data-probe="bold" className="text-body-sm">Heading</th>
          </tr>
        </thead>
      </table>
    </div>
  )
}
`

async function checkProbes(page) {
  const color = (probe) =>
    page.evaluate((name) => getComputedStyle(document.querySelector(`[data-probe="${name}"]`)).backgroundColor, probe)
  const settle = () =>
    page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))))
  const html = async (attributes) => {
    await settle()
    await page.evaluate((next) => {
      const root = document.documentElement
      root.classList.remove("dark", "light")
      root.removeAttribute("data-color-scheme")
      if (next.className) root.classList.add(next.className)
      if (next.scheme) root.setAttribute("data-color-scheme", next.scheme)
    }, attributes)
  }
  const darkVariant = {}
  await page.emulateMedia({ colorScheme: "dark" })
  await html({})
  darkVariant.systemDark = (await color("dark")) === (await color("dark-reference"))
  await html({ scheme: "light" })
  darkVariant.optedIntoLight = (await color("dark")) !== (await color("dark-reference"))
  await page.emulateMedia({ colorScheme: "light" })
  await html({ className: "dark" })
  darkVariant.darkClass = (await color("dark")) === (await color("dark-reference"))
  await html({})
  const weights = await page.evaluate(() =>
    [...document.querySelectorAll('[data-probe="bold"]')].map((node) => getComputedStyle(node).fontWeight),
  )
  if (weights.length !== 3 || weights.some((weight) => Number(weight) < 600))
    throw new Error(`A body type step overrides bold: ${weights.join(", ")}`)
  const tokens = await page.evaluate(() =>
    [...document.querySelectorAll('[data-probe="token"]')].map((node) => {
      const style = getComputedStyle(node)
      return [style.backgroundColor, style.borderTopColor, style.color]
    }),
  )
  const unresolved = tokens.flat().filter((value) => value === "rgba(0, 0, 0, 0)" || value === "rgb(0, 0, 0)")
  if (tokens.length !== 3 || unresolved.length > 0)
    throw new Error(`The soft tone and skeleton tokens didn't resolve: ${JSON.stringify(tokens)}`)
  const link = await page.evaluate(() => {
    const context = new OffscreenCanvas(1, 1).getContext("2d")
    context.fillStyle = getComputedStyle(document.querySelector('[data-probe="link"]')).color
    context.fillRect(0, 0, 1, 1)
    return Array.from(context.getImageData(0, 0, 1, 1).data.slice(0, 3))
  })
  if (Math.max(...link) - Math.min(...link) < 60) throw new Error(`Links are grey: rgb(${link.join(", ")})`)
  const merged = await page.evaluate(() => document.querySelector('[data-probe="cn"]').className)
  if (merged !== "text-meta text-muted-foreground")
    throw new Error(`cn() doesn't know the theme's utilities: "${merged}"`)
  console.log("dark: variant:", JSON.stringify(darkVariant))
  if (!Object.values(darkVariant).every(Boolean))
    throw new Error(`dark: doesn't follow .dark and the system unless the page opts into light`)
}

async function withPage(dist, callback) {
  const playwright = await import(
    pathToFileURL(createRequire(join(dist, "..", "package.json")).resolve("playwright")).href
  )
  const { chromium } = playwright.default ?? playwright
  const site = createServer((request, response) => {
    const path = new URL(request.url, "http://x").pathname
    const file = normalize(join(dist, path === "/" ? "index.html" : decodeURIComponent(path)))
    if (!file.startsWith(dist) || !existsSync(file)) return response.writeHead(404).end()
    response.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" })
    createReadStream(file).pipe(response)
  })
  await new Promise((ready) => site.listen(0, "127.0.0.1", ready))
  const browser = await chromium.launch({ channel: "chrome" })
  try {
    const page = await browser.newPage()
    await page.addInitScript(() => {
      const Native = globalThis.Worker
      globalThis.workersStarted = 0
      globalThis.Worker = class extends Native {
        constructor(...args) {
          super(...args)
          globalThis.workersStarted += 1
        }
      }
    })
    await page.goto(`http://127.0.0.1:${site.address().port}/`)
    await page.locator("[data-probe]").first().waitFor()
    await page.addStyleTag({ content: "*, ::before, ::after { transition: none !important; }" })
    await callback(page)
    await checkProbes(page)
  } finally {
    await browser.close()
    site.close()
  }
}

async function checkEverything(page) {
  const result = await page.evaluate(async () => {
    await document.fonts.ready
    const html = document.documentElement
    const button = [...document.querySelectorAll('[data-slot="button"]')].find((node) => node.textContent === "Save")
    const context = new OffscreenCanvas(1, 1).getContext("2d")
    const rgb = (color) => {
      context.clearRect(0, 0, 1, 1)
      context.fillStyle = color
      context.fillRect(0, 0, 1, 1)
      return Array.from(context.getImageData(0, 0, 1, 1).data.slice(0, 3)).join(",")
    }
    const colors = () => {
      const style = getComputedStyle(button)
      return { background: rgb(style.backgroundColor), text: rgb(style.color) }
    }
    const neutral = colors()
    html.setAttribute("data-palette", "blue")
    const blue = colors()
    html.removeAttribute("data-palette")
    html.style.setProperty("--brand", "oklch(0.9 0.15 95)")
    const yellow = colors()
    html.style.removeProperty("--brand")
    const spacing = () => {
      const badge = getComputedStyle(document.querySelector("[data-slot=badge]"))
      return {
        button: getComputedStyle(button).columnGap,
        badge: `${badge.paddingInlineStart} ${badge.paddingBlockStart}`,
        card: getComputedStyle(document.querySelector("[data-slot=card]")).rowGap,
      }
    }
    const compactSpacing = spacing()
    const theme = html.getAttribute("data-theme")
    html.removeAttribute("data-theme")
    const defaultSpacing = spacing()
    html.setAttribute("data-theme", theme)
    const card = getComputedStyle(document.querySelector("[data-slot=card]"))
    const keyword = await new Promise((done) => {
      const started = Date.now()
      const poll = () => {
        const found = document.querySelector('[data-slot="code-block"][aria-label="answer.ts"] .text-syntax-keyword')
        if (found || Date.now() - started > 5000) done(found)
        else setTimeout(poll, 100)
      }
      poll()
    })
    const diffed = await new Promise((done) => {
      const started = Date.now()
      const poll = () => {
        const cells = [...document.querySelectorAll('[aria-label="Worker diff"] [role="gridcell"]')]
        const added = cells.find((cell) => cell.textContent.includes("Added, line 2"))
        if (added || Date.now() - started > 5000) done(added?.textContent ?? null)
        else setTimeout(poll, 100)
      }
      poll()
    })
    return {
      diff: {
        worker: diffed,
        workers: globalThis.workersStarted,
        patch: document.querySelector('[aria-label="Patch diff"] [data-slot="diff-file-header"]')?.textContent ?? null,
      },
      code: keyword ? { text: keyword.textContent, color: rgb(getComputedStyle(keyword).color) } : null,
      blocks: ["hero", "bento", "steps", "site-footer", "section-heading"].filter(
        (slot) => !document.querySelector(`[data-slot="${slot}"]`),
      ),
      link: document.querySelector('[data-slot="link"]')?.getAttribute("data-variant"),
      git: {
        commits: document.querySelectorAll('[aria-label="History"] [data-slot="commit-row"]').length,
        files: [...document.querySelectorAll('[role="tree"][aria-label="Changes"] [role="treeitem"]')].map(
          (row) => row.getAttribute("aria-label") ?? row.textContent,
        ),
      },
      markdown: document.querySelector(".cm-line[data-md-heading]")?.textContent,
      workspace: [...document.querySelectorAll("[data-slot=document-outline] button")].map((node) => node.textContent),
      tokens: [...document.querySelectorAll("[data-slot=token-input-token]")].map((chip) => ({
        text: chip.firstChild?.textContent,
        fill: rgb(getComputedStyle(chip).backgroundColor),
        remove: chip.querySelector("[data-slot=token-input-token-remove]")?.getAttribute("title"),
      })),
      carouselStatus: document.querySelector("[data-slot=carousel-status]")?.textContent,
      shell: [...document.querySelectorAll('[data-slot="shell"] nav[aria-label="Shell"] a[aria-current="page"]')]
        .map((link) => link.textContent)
        .join(),
      border: { card: rgb(card.borderTopColor), token: rgb(getComputedStyle(html).getPropertyValue("--border")) },
      spacing: { compact: compactSpacing, default: defaultSpacing },
      font: [...document.fonts].some((font) => font.family.includes("Geist") && font.status === "loaded"),
      neutral,
      blue,
      yellow,
    }
  })
  console.log("In Chrome:", JSON.stringify(result))
  if (result.code?.text !== "const" || result.code.color === "0,0,0")
    throw new Error(`CodeBlock didn't highlight with the syntax tokens: ${JSON.stringify(result.code)}`)
  if (!result.diff.worker?.includes("line five") || result.diff.workers < 1)
    throw new Error(`TextDiff didn't diff in its worker: ${JSON.stringify(result.diff)}`)
  if (!result.diff.patch?.includes("a.ts"))
    throw new Error(`GitDiff didn't render its file: ${JSON.stringify(result.diff)}`)
  if (result.git.commits !== 2 || result.git.files.length < 3)
    throw new Error(`CommitHistory and GitTree, sharing trail-rows, didn't render: ${JSON.stringify(result.git)}`)
  if (result.blocks.length > 0) throw new Error(`Blocks missing from the landing page: ${result.blocks.join(", ")}`)
  if (result.link !== "inline") throw new Error("Link didn't render")
  if (result.markdown !== "Notes") throw new Error(`MarkdownEditor didn't render its heading: ${result.markdown}`)
  if (result.workspace?.join() !== "Plan,Goals")
    throw new Error(`DocumentWorkspace didn't render its outline: ${JSON.stringify(result.workspace)}`)
  if (result.tokens.map((token) => `${token.text}:${token.remove}`).join() !== "bug:Remove bug,docs:Remove docs")
    throw new Error(`TokenInput didn't render its chips: ${JSON.stringify(result.tokens)}`)
  if (result.tokens.some((token) => token.fill === "0,0,0" || token.fill === "255,255,255"))
    throw new Error(`TokenInput chips have no tone fill: ${JSON.stringify(result.tokens)}`)
  if (result.shell !== "Shell B") throw new Error(`Shell didn't mark its current route: ${String(result.shell)}`)
  if (result.carouselStatus !== "1 of 3") throw new Error(`CarouselStatus shows ${String(result.carouselStatus)}`)
  if (result.border.card !== result.border.token) throw new Error("Borders don't use --border")
  if (!result.font) throw new Error("The Geist font didn't load in the built app")
  if (result.blue.background === result.neutral.background) throw new Error("data-palette didn't change --primary")
  if (result.yellow.text === result.neutral.text) throw new Error("--primary-foreground didn't follow a light --brand")
  const expected = {
    compact: { button: "4px", badge: "6px 2px", card: "12px" },
    default: { button: "6px", badge: "8px 2px", card: "16px" },
  }
  if (JSON.stringify(result.spacing) !== JSON.stringify(expected))
    throw new Error(`The spacing roles didn't resolve: ${JSON.stringify(result.spacing)}`)
}

function childRules(block) {
  const rules = []
  let depth = 0
  let text = ""
  for (const char of block) {
    if (char === "{") {
      if (depth === 0) rules.push({ selector: text.trim().replaceAll(/\s+/g, " "), body: "" })
      else text += char
      if (depth === 0) text = ""
      depth++
    } else if (char === "}") {
      depth--
      if (depth < 0) break
      if (depth === 0) {
        rules.at(-1).body = text.trim().replaceAll(/\s+/g, " ")
        text = ""
      } else text += char
    } else if (char === ";" && depth === 0) text = ""
    else text += char
  }
  return rules
}

function checkStylesheet(css) {
  const darkVariants = css.match(/^@custom-variant dark\b.*$/gm) ?? []
  if (!darkVariants.at(-1)?.startsWith("@custom-variant dark {"))
    throw new Error(`The theme's dark variant isn't the last one: ${JSON.stringify(darkVariants)}`)
  const selfReferences = [...css.matchAll(/(--[\w-]+)\s*:\s*var\(\1\)\s*;/g)].map(([line]) => line)
  if (selfReferences.length > 0) throw new Error(`The stylesheet has self-references: ${selfReferences.join(" ")}`)
  if (/--color-brand\s*:/.test(css)) throw new Error("A seed leaked into @theme inline as a colour")
  if (/--radius-\w+: calc\(var\(--radius\) \*/.test(css) || !css.includes("--radius-4xl: calc(var(--radius) + 24px)"))
    throw new Error("shadcn's radius scale is left beside the theme's")
  const bases = [...css.matchAll(/^@layer base \{$/gm)]
  if (bases.length !== 1) throw new Error(`Expected one @layer base, found ${bases.length}`)
  const rules = childRules(css.slice(bases[0].index + bases[0][0].length)).filter(
    ({ selector }) => !selector.startsWith("@"),
  )
  const selectors = rules.map(({ selector }) => selector)
  if (new Set(selectors).size !== selectors.length) throw new Error(`Duplicated base rules: ${selectors.join(" | ")}`)
  const expected = { "*": "@apply border-border outline-ring/50;", body: "@apply bg-background text-foreground;" }
  for (const [selector, body] of Object.entries(expected)) {
    const found = rules.find((rule) => rule.selector === selector)?.body
    if (found !== body) throw new Error(`The base rule for ${selector} is ${JSON.stringify(found)}, not ${body}`)
  }
}

function checkBuiltCss(css, expected) {
  for (const text of expected) {
    if (!css.includes(text) && !css.includes(text.replaceAll('"', ""))) throw new Error(`Built CSS is missing ${text}`)
  }
}

const everythingMain = `import type { CSSProperties } from "react"
import { createRoot } from "react-dom/client"
import { AgentTaskBoard } from "@/components/ui/agent-task-board"
import { Shell } from "@/components/ui/shell"
import { Appearance, createAppearance } from "@/components/ui/appearance"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { DataState } from "@/components/ui/data-state"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Form, FormActions, FormField, FormRootError, formMessagesEs } from "@/components/ui/form"
import { FormDialog } from "@/components/ui/form-dialog"
import type { StandardSchemaV1 } from "@standard-schema/spec"
import { Input } from "@/components/ui/input"
import { CodeBlock } from "@/components/ui/code-block"
import { GitDiff } from "@/components/ui/git-diff"
import { CommitHistory } from "@/components/ui/commit-history"
import { GitTree } from "@/components/ui/git-tree"
import { TextDiff } from "@/components/ui/text-diff"
import { Hero } from "@/components/ui/hero"
import { Link } from "@/components/ui/link"
import { LandingPage } from "@/components/landing-page"
import { PageHeader } from "@/components/ui/page-header"
import { PageLayout } from "@/components/ui/page-layout"
import { SearchField } from "@/components/ui/search-field"
import { MobileNav } from "@/components/ui/mobile-nav"
import { MarkdownEditor } from "@/components/ui/markdown-editor"
import { markdownCodeLanguages } from "@/components/ui/markdown-editor-languages"
import { extractHeadings, MarkdownView } from "@/components/ui/markdown-view"
import { DocumentOutline, DocumentQuickOpen, DocumentWorkspace } from "@/components/ui/document-workspace"
import { Section } from "@/components/ui/section"
import { SiteHeader } from "@/components/ui/site-header"
import { SkipLink } from "@/components/ui/skip-link"
import { Topbar } from "@/components/ui/topbar"
import { Spinner } from "@/components/ui/spinner"
import { StatusDot } from "@/components/ui/status-pill"
import { TokenInput, TokenInputEditor } from "@/components/ui/token-input"
import { Carousel, CarouselContent, CarouselItem, CarouselStatus, CarouselViewport } from "@/components/ui/carousel"
import type { TaskView } from "@/lib/agent-task-types"
import { cn } from "@/lib/utils"
import "./index.css"
${probes}
const tasks: TaskView[] = [
  {
    id: "T-1",
    title: "Index the docs",
    status: "working",
    dependsOn: [],
    acceptance: [{ text: "Every page is indexed", result: "pass" }],
    attempts: [
      {
        id: "T-1-A1",
        kind: "implementation",
        status: "active",
        configured: { provider: "codex", model: "gpt" },
        startedAt: "2026-11-15T17:40:00Z",
        liveness: "running",
      },
    ],
    updatedAt: "2026-11-15T18:40:00Z",
  },
]

const profileSchema: StandardSchemaV1<{ name: string }> = {
  "~standard": {
    version: 1,
    vendor: "consumer",
    validate: (value) => ({ value: value as { name: string } }),
  },
}

const appearance = createAppearance({ theme: "compact" })
appearance.apply()

function App() {
  return (
    <Appearance appearance={appearance}>
    <SkipLink>Skip to content</SkipLink>
    <SiteHeader label="Main" brand={<a href="/">Home</a>} items={[{ label: "Docs", href: "/docs", current: true }, { label: "More docs", items: [{ label: "API", href: "/api" }] }]} />
    <Topbar brand={<span>App</span>} trailing={<Button>Account</Button>} />
    <PageLayout as="main" header={<PageHeader eyebrow="Consumer" title="Page" />}>
    <Section title="Data" action={<Spinner label="Syncing" />}>
      <DataState status="success" data={["a"]} labels={{ errorTitle: "Failed", emptyTitle: "Empty" }}>
        {(items) => <p>{items.join(", ")}</p>}
      </DataState>
    </Section>
    <AgentTaskBoard tasks={tasks} mode="snapshot" generatedAt="2026-11-15T18:42:00Z" timeZone="UTC" />
    <CommitHistory aria-label="History" className="max-h-64" now="2026-11-15T19:00:00Z" commits={[{ id: "c2", parents: ["c1"], message: "Fix \`src/a.ts\`", date: "2026-11-15T18:00:00Z" }, { id: "c1", parents: [], message: "Initial commit", date: "2026-11-15T17:00:00Z" }]} />
    <GitTree aria-label="Changes" className="max-h-64" files={[{ path: "src/a.ts", status: "modified" }, "README.md"]} />
    <Card data-theme="glass">
      <CardHeader><CardTitle className="narrow:text-title">Consumer</CardTitle></CardHeader>
      <CardContent>
        <Badge variant="success">Ready</Badge>
        <Badge tone="warning">Stale</Badge>
        <StatusDot tone="success" label="Online" pulse />
        <Button onClick={() => Promise.resolve()}>Save</Button>
        <Button loading>Saving</Button>
        <Field><FieldLabel>Name</FieldLabel><Input /></Field>
        <Field><FieldLabel>Labels</FieldLabel><TokenInput tokenType="label" defaultValue={["bug", "docs"] as const} tone="info"><TokenInputEditor placeholder="Add a label" /></TokenInput></Field>
        <Carousel aria-label="Slides"><CarouselStatus /><CarouselViewport><CarouselContent>{["One", "Two", "Three"].map((name) => <CarouselItem key={name}>{name}</CarouselItem>)}</CarouselContent></CarouselViewport></Carousel>
        <SearchField label="Search" onSearch={() => {}} />
        <Form schema={profileSchema} defaultValues={{ name: "" }} onSubmit={() => {}} messages={formMessagesEs} label="Profile">
          <FormField name="name" label="Display name"><Input /></FormField>
          <FormRootError />
          <FormActions submitLabel="Save profile" />
        </Form>
        <MarkdownEditor label="Notes" defaultValue={"# Notes\\n\\n**Bold** and [[link]]\\n"} codeLanguages={markdownCodeLanguages} />
        <MarkdownView markdown="- [x] done" />
        <FormDialog schema={profileSchema} defaultValues={{ name: "" }} onSubmit={() => {}} trigger="Edit profile" title="Profile" submitLabel="Save" cancelLabel="Cancel" confirmDiscard="Discard changes?" reviewStep={{ render: (values) => <p>{values.name}</p>, editLabel: "Edit", confirmLabel: "Confirm" }}>
          <FormField name="name" label="Profile name"><Input /></FormField>
        </FormDialog>
        <Dialog><DialogTrigger>Open</DialogTrigger><DialogContent><DialogTitle>Hi</DialogTitle></DialogContent></Dialog>
        <ConfirmDialog trigger="Delete" title="Delete?" confirmLabel="Delete" tone="destructive" agentConfirm="Deletes it" onConfirm={() => {}} />
      </CardContent>
    </Card>
    <Hero headingLevel={2} title="Blocks" install="npx shadcn add @eskais/hero" actions={<Link href="#docs" onFollow={() => {}}>Docs</Link>} />
    <CodeBlock code={"const answer = 42"} language="ts" title="answer.ts" lineNumbers />
    <TextDiff aria-label="Worker diff" oldText={"line 1\\nline 5\\n"} newText={"line 1\\nline five\\n"} language="ts" worker workerThreshold={1} className="h-40" />
    <GitDiff aria-label="Patch diff" patch={"diff --git a/a.ts b/a.ts\\n--- a/a.ts\\n+++ b/a.ts\\n@@ -1 +1 @@\\n-const a = 1\\n+const a = 2\\n"} className="h-64" />
    <DocumentWorkspace className="h-96" document={<MarkdownView markdown={"# Plan\\n\\n## Goals\\n"} />} explorer={<p>Files</p>} aside={<DocumentOutline headings={extractHeadings("# Plan\\n\\n## Goals\\n")} />} quickOpen={<DocumentQuickOpen items={[{ value: "plan", label: "Plan" }]} onOpen={() => {}} />} saveState="saved" />
    <LandingPage as="div" />
    <div className="h-96 overflow-y-auto">
      <Shell as="div" mainId="shell-main" style={{ "--shell-height": "24rem" } as CSSProperties} searchShortcut={false} currentHref="/shell/b" routes={[{ id: "a", label: "Shell A", href: "/shell/a", group: "Shell", mobile: true }, { id: "b", label: "Shell B", href: "/shell/b", group: "Old" }]} groups={[{ id: "Shell", label: "Shell" }, { id: "Old", label: "Old", tone: "muted" }]} labels={{ skipToContent: "Skip to the shell", sidebar: "Shell", mobileNav: "Shell bar", openSearch: "Search the shell" }}><p>Shell page</p></Shell>
    </div>
    <Probes />
    </PageLayout>
    <MobileNav label="Phone" items={[{ label: "Home", href: "/", icon: <span aria-hidden="true">H</span>, current: true }]} />
    </Appearance>
  )
}

createRoot(document.getElementById("root")!).render(<App />)
`

// Spec: valid as main.tsx and as main.jsx, for a project with `tsx: false`: no type syntax at all.
const liveSkyMain = `import { createRoot } from "react-dom/client"
import { LiveSky } from "@/components/ui/live-sky"
import { cn } from "@/lib/utils"
import "./index.css"
${probes}
let frames = 0
const coruna = { latitude: 43.37, longitude: -8.4, name: "A Coruña" }
const downpour = { weatherCode: 65, precipitation: 9, rain: 9, cloudCover: 100, windSpeed: 30 }

function App() {
  return (
    <main className="flex flex-col gap-items p-inset-surface">
      <LiveSky
        label="Consumer sky"
        simulate={{ location: coruna, time: Date.UTC(2026, 10, 25, 11), weather: downpour }}
        onFrame={() => {
          frames += 1
          document.body.dataset.skyFrames = String(frames)
        }}
      />
      <Probes />
    </main>
  )
}

createRoot(document.querySelector("#root") ?? document.body).render(<App />)
`

const framesProvingTheWorkerDraws = 5
async function checkLiveSky(page) {
  await page.waitForFunction(
    () => Number(document.querySelector('[data-slot="live-sky-scene"]')?.dataset.staticPaints) >= 2,
    undefined,
    { timeout: 30_000 },
  )
  const framesNow = () => page.evaluate(() => Number(document.body.dataset.skyFrames ?? 0))
  const before = await framesNow()
  await page.waitForTimeout(1500)
  const drawn = (await framesNow()) - before
  const sky = await page.evaluate(() => {
    const scene = document.querySelector('[data-slot="live-sky-scene"]')
    return {
      thread: scene.dataset.thread,
      renderer: scene.dataset.renderer,
      mode: scene.dataset.mode,
      workers: globalThis.workersStarted,
    }
  })
  console.log("LiveSky:", JSON.stringify({ ...sky, frames: drawn }))
  if (sky.thread !== "worker" || sky.workers < 1)
    throw new Error(`LiveSky didn't draw in its worker in the production build: ${JSON.stringify(sky)}`)
  if (sky.mode !== "running" || drawn < framesProvingTheWorkerDraws)
    throw new Error(`LiveSky drew ${String(drawn)} frames in 1.5 s, in mode ${String(sky.mode)}`)
}

const vinylMain = `import { createRoot } from "react-dom/client"
import { VinylScrubber } from "@/components/ui/vinyl-scrubber"
import { cn } from "@/lib/utils"
import "./index.css"
${probes}
function App() {
  return (
    <main className="flex flex-col gap-items p-inset-surface">
      <VinylScrubber label="Consumer track" title="Consumer" subtitle="Side A" duration={240} defaultValue={30} />
      <Probes />
    </main>
  )
}

createRoot(document.querySelector("#root") ?? document.body).render(<App />)
`

async function checkVinyl(page) {
  await page.waitForFunction(
    () => document.querySelector('[data-slot="vinyl-turntable"]')?.dataset.renderer === "webgl",
    undefined,
    { timeout: 30_000 },
  )
  const deck = await page.evaluate(() => ({
    workers: globalThis.workersStarted,
    canvas: document.querySelectorAll('[data-slot="vinyl-canvas"]').length,
  }))
  console.log("VinylScrubber:", JSON.stringify(deck))
  if (deck.workers < 1 || deck.canvas !== 1)
    throw new Error(`VinylScrubber didn't draw its turntable in its worker: ${JSON.stringify(deck)}`)
}

const vinylScenario = {
  css: `@layer ui-sdk;
@import "tailwindcss";
`,
  items: ["theme", "vinyl-scrubber"],
  main: vinylMain,
  builtCss: ["--vinyl-played"],
  check: checkVinyl,
  literals: ["@"],
}

const themeOnlyMain = `import { createRoot } from "react-dom/client"
import { cn } from "@/lib/utils"
import "./index.css"
${probes}
function App() {
  return (
    <main className="flex flex-col gap-items p-inset-surface">
      <h1 className="text-title">Consumer</h1>
      <Probes />
    </main>
  )
}

createRoot(document.getElementById("root")!).render(<App />)
`

const liquidMain = `import { createRoot } from "react-dom/client"
import { Button } from "@/components/ui/button"
import { LiquidLens } from "@/components/ui/liquid-lens"
import { cn } from "@/lib/utils"
import "./index.css"
${probes}
document.documentElement.dataset.theme = "liquid"

function App() {
  return (
    <main className="flex flex-col gap-items p-inset-surface">
      <LiquidLens />
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <div data-testid="floating" className="surface-floating p-inline">Floating</div>
      <Probes />
    </main>
  )
}

createRoot(document.getElementById("root")!).render(<App />)
`

async function checkLiquid(page) {
  const state = await page.evaluate(() => {
    const secondary = document.querySelector('[data-variant="secondary"]')
    const outline = document.querySelector('[data-variant="outline"]')
    const floating = document.querySelector('[data-testid="floating"]')
    return {
      lens: Boolean(document.getElementById("eskais-liquid-lens")),
      backdrop: getComputedStyle(floating).backdropFilter,
      rim: getComputedStyle(secondary).boxShadow,
      fill: getComputedStyle(secondary).backgroundColor,
      edge: getComputedStyle(outline).borderTopColor,
    }
  })
  if (!state.lens) throw new Error("LiquidLens didn't render its filter in Chrome")
  if (!state.backdrop.startsWith('url("#eskais-liquid-lens")')) {
    throw new Error(`The floating surface doesn't refract: ${state.backdrop}`)
  }
  if (!state.rim.includes("inset")) throw new Error(`The secondary button has no glass rim: ${state.rim}`)
  if (!state.fill.endsWith("/ 0.45)")) throw new Error(`The secondary button isn't glass: ${state.fill}`)
  if (state.edge === "rgba(0, 0, 0, 0)") throw new Error("The outline button lost its edge")
}

const aliasesMain = `import { createRoot } from "react-dom/client"
import { AgentTaskBoard } from "@/components/ui/agent-task-board"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import "./index.css"
${probes}
function App() {
  return (
    <main className="flex flex-col gap-items p-inset-surface">
      <Badge tone="violet">Design</Badge>
      <Alert tone="info"><AlertTitle>Queued</AlertTitle></Alert>
      <AgentTaskBoard tasks={[]} mode="snapshot" generatedAt="2026-11-15T18:42:00Z" timeZone="UTC" />
      <Probes />
    </main>
  )
}

createRoot(document.getElementById("root")!).render(<App />)
`

const importsMain = `import { createRoot } from "react-dom/client"
import { z } from "zod"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Form, FormField } from "@/components/ui/form"
import { formMessagesEs } from "@/components/ui/form-messages"
import { Input } from "@/components/ui/input"
import { ToastStack } from "@/components/ui/toast"
import { cn } from "@/lib/utils"
import "./index.css"
${probes}
const schema = z.object({ name: z.string().min(1) })

function App() {
  return (
    <main className="flex flex-col gap-items p-inset-surface">
      <h1 className="text-title">Imports</h1>
      <Badge tone="violet">Design</Badge>
      <Alert tone="info"><AlertTitle>Queued</AlertTitle></Alert>
      <Form schema={schema} defaultValues={{ name: "" }} messages={formMessagesEs} onSubmit={() => {}} label="Name">
        <FormField name="name" label="Name"><Input /></FormField>
      </Form>
      <ToastStack labels={{ close: "Dismiss" }} />
      <Probes />
    </main>
  )
}

createRoot(document.getElementById("root")!).render(<App />)
`

const layoutsMain = `import { createRoot } from "react-dom/client"
import { Bar, BarChart } from "recharts"
import { DashboardCard, DashboardChart, DashboardGrid, DashboardMeter, DashboardStat, DashboardStats } from "@/components/ui/dashboard-grid"
import { DescriptionDetails, DescriptionItem, DescriptionTerm } from "@/components/ui/description-list"
import { List, ListItem } from "@/components/ui/list-item"
import { MasterDetail } from "@/components/ui/master-detail"
import { SettingsDangerAction, SettingsDangerZone, SettingsFacts, SettingsPage, SettingsRow, SettingsSection } from "@/components/ui/settings-page"
import { Switch } from "@/components/ui/switch"
import { createUrlParam } from "@/lib/url-param"
import { cn } from "@/lib/utils"
import "./index.css"
${probes}
const devices = [{ id: "d1", name: "Kitchen sensor" }, { id: "d2", name: "Hall camera" }] as const
const deviceParam = createUrlParam("device", { in: "hash" })
const sectionParam = createUrlParam("section", { history: "replace" })

function App() {
  return (
    <main className="flex flex-col gap-section p-inset-surface">
      <MasterDetail
        label="Devices"
        className="h-96 rounded-surface border"
        url={deviceParam}
        items={devices.map((device) => ({ id: device.id, label: device.name }))}
        renderList={(state) => (
          <List aria-label="All devices">
            {devices.map((device) => <ListItem key={device.id} title={device.name} {...state.itemProps(device.id)} />)}
          </List>
        )}
        renderDetail={(id) => ({ title: devices.find((device) => device.id === id)?.name ?? id, content: <p>Online</p> })}
        emptyDetail={<p>Pick a device</p>}
      />
      <DashboardGrid stats={<DashboardStats aria-label="Week"><DashboardStat label="Runs" value={12} /></DashboardStats>}>
        <DashboardCard title="Runs" span={2} status="success" data={[{ day: "Mon", runs: 3 }]}>
          {(data) => <DashboardChart config={{ runs: { label: "Runs", color: "var(--chart-1)" } }}><BarChart data={data}><Bar dataKey="runs" /></BarChart></DashboardChart>}
        </DashboardCard>
        <DashboardCard title="Quota"><DashboardMeter label="Hours used" value={40} /></DashboardCard>
      </DashboardGrid>
      <SettingsPage url={sectionParam}>
        <SettingsSection id="account" title="Account">
          <SettingsRow label="Email updates"><Switch /></SettingsRow>
        </SettingsSection>
        <SettingsSection id="device" title="This device">
          <SettingsFacts aria-label="This device"><DescriptionItem><DescriptionTerm>Browser</DescriptionTerm><DescriptionDetails>Chrome</DescriptionDetails></DescriptionItem></SettingsFacts>
        </SettingsSection>
        <SettingsDangerZone id="danger" title="Danger zone">
          <SettingsDangerAction label="Delete account" trigger="Delete account" title="Delete it?" confirmLabel="Delete forever" agentConfirm="Deletes the account" onConfirm={() => {}} />
        </SettingsDangerZone>
      </SettingsPage>
      <Probes />
    </main>
  )
}

createRoot(document.getElementById("root")!).render(<App />)
`

const releaseAgeMain = `import { createRoot } from "react-dom/client"
import { XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import "./index.css"
${probes}
function App() {
  return (
    <main className="flex flex-col gap-items p-inset-surface">
      <h1 className="text-title">Consumer</h1>
      <Button size="icon" aria-label="Close"><XIcon /></Button>
      <Dialog><DialogTrigger>Open</DialogTrigger><DialogContent><DialogTitle>Hi</DialogTitle></DialogContent></Dialog>
      <Probes />
    </main>
  )
}

createRoot(document.getElementById("root")!).render(<App />)
`

async function checkLayouts(page) {
  await page.getByRole("button", { name: "Hall camera" }).click()
  await page.getByRole("region", { name: "Hall camera" }).waitFor()
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("data-slot"))
  if (focused !== "master-detail-title") throw new Error(`MasterDetail focused ${String(focused)}, not the title`)
  if (!page.url().includes("device=d2")) throw new Error(`MasterDetail didn't write the URL: ${page.url()}`)
  await page.getByRole("button", { name: "Close detail" }).click()
  const back = await page.evaluate(() => document.activeElement?.textContent)
  if (back !== "Hall camera") throw new Error(`Closing returned focus to ${String(back)}`)
  const cards = await page
    .locator('[data-slot="dashboard-card"]')
    .evaluateAll((all) => all.map((card) => Math.round(card.getBoundingClientRect().height)))
  if (cards.length !== 2 || cards[0] !== cards[1]) throw new Error(`Dashboard cards in a row differ: ${cards.join()}`)
  if (!(await page.getByRole("meter", { name: "Hours used" }).isVisible())) throw new Error("No ring meter")
  const nav = page.getByRole("navigation", { name: "Settings sections" })
  await nav.getByRole("link", { name: "Danger zone" }).click()
  const heading = await page.evaluate(() => document.activeElement?.textContent)
  if (heading !== "Danger zone") throw new Error(`Going to a section focused ${String(heading)}`)
  if (!page.url().includes("section=danger")) throw new Error(`SettingsPage didn't write the URL: ${page.url()}`)
  console.log("layouts: master-detail, dashboard-grid and settings-page work in the consumer")
}

const serverDataMain = `import { createRoot } from "react-dom/client"
import { Field, FieldLabel } from "@/components/ui/field"
import { ListItem } from "@/components/ui/list-item"
import { ServerCombobox } from "@/components/ui/server-combobox"
import { ServerDataTable } from "@/components/ui/server-data-table"
import { ServerList } from "@/components/ui/server-list"
import { arraySource } from "@/lib/array-source"
import { matchesFilter } from "@/lib/filter-ast"
import { rsql } from "@/lib/filter-rsql"
import { defineFilters, toFilterAst, type FilterValues } from "@/lib/filter-schema"
import { hashUrlState } from "@/lib/url-state"
import { cn } from "@/lib/utils"
import "./index.css"
${probes}
type Task = { id: string; title: string; status: "open" | "done" }
const tasks: Task[] = Array.from({ length: 12 }, (_, index) => ({
  id: "T-" + String(index + 1),
  title: "Task " + String(index + 1),
  status: index % 3 === 0 ? "done" : "open",
}))
const filters = defineFilters({
  q: { kind: "text", label: "Search" },
  status: { kind: "options", label: "Status", multiple: true, options: [{ value: "open", label: "Open" }, { value: "done", label: "Done" }] },
})
type Values = FilterValues<typeof filters>
const source = arraySource<Task, Values>(tasks, {
  delay: 50,
  search: { fields: ["title"] },
  filter: (task, values) => matchesFilter(toFilterAst(filters, values), task),
})
const options = arraySource<Task, { q?: string }>(tasks, { search: { fields: ["title"] } })
const labels = { errorTitle: "Couldn't load", retry: "Retry", emptyTitle: "Nothing here" }

function App() {
  return (
    <main className="flex flex-col gap-items p-inset-surface">
      <p data-wire>{rsql(toFilterAst(filters, { status: ["done"] }))}</p>
      <ServerDataTable
        label="Tasks"
        source={source}
        filters={filters}
        filterUi="chips"
        urlState={hashUrlState()}
        pageSize={5}
        columns={[{ id: "title", header: "Title", cell: (task) => task.title, sortField: "title" }]}
        labels={labels}
      />
      <ServerList<Task, typeof filters>
        aria-label="Task list"
        source={source}
        pageSize={5}
        infinite={false}
        itemText={(task) => task.title}
        renderItem={(task) => <ListItem id={task.id} title={task.title} />}
        labels={labels}
      />
      <Field>
        <FieldLabel>Blocked by</FieldLabel>
        <ServerCombobox source={options} getLabel={(task) => task.title} />
      </Field>
      <Probes />
    </main>
  )
}

createRoot(document.getElementById("root")!).render(<App />)
`

async function checkServerData(page) {
  const status = page.locator('[data-slot="server-data-table-footer"] output')
  await status.filter({ hasText: "Showing 1–5 of 12" }).waitFor()
  if ((await page.locator("[data-wire]").textContent()) !== 'status=in=("done")')
    throw new Error("rsql wrote the wrong filter")
  await page.getByRole("button", { name: "Next page" }).click()
  await status.filter({ hasText: "Showing 6–10 of 12" }).waitFor()
  if (!(await page.evaluate(() => location.hash)).includes("page=2")) throw new Error("The page isn't in the URL")
  await page.getByRole("button", { name: "Add filter" }).click()
  await page.getByRole("menuitem", { name: "Status" }).click()
  await page.getByRole("checkbox", { name: "Done" }).click()
  await status.filter({ hasText: "Showing 1–4 of 4" }).waitFor()
  await page.keyboard.press("Escape")
  await page.getByRole("button", { name: "Load more" }).click()
  await page.locator('[data-slot="server-list-footer"] output').filter({ hasText: "Showing 1–10 of 12" }).waitFor()
}

const mockupCliMain = `import { createRoot } from "react-dom/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import "./index.css"
${probes}
function App() {
  return (
    <main className="flex flex-col gap-items p-inset-surface">
      <h1 className="text-title">Consumer</h1>
      <Card><CardHeader><CardTitle>Atlas</CardTitle></CardHeader><CardContent><Button>Open</Button></CardContent></Card>
      <Probes />
    </main>
  )
}

createRoot(document.getElementById("root")!).render(<App />)
`

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
}
`

const liveSkyScenario = {
  css: `@layer ui-sdk;\n@import "tailwindcss";\n`,
  items: ["theme", "live-sky"],
  main: liveSkyMain,
  builtCss: ["--brand"],
  check: checkLiveSky,
  literals: ["@"],
}

const scenarios = {
  "live-sky": {
    ...liveSkyScenario,
    files: [
      "src/components/ui/live-sky.tsx",
      "src/components/ui/live-sky-engine.ts",
      "src/components/ui/live-sky-runner.ts",
      "src/components/ui/live-sky-worker.js",
    ],
  },
  // Spec: shadcn writes a `tsx: false` project's TypeScript as JavaScript and copies the worker entry as it is; its
  // extensionless import of the runner has to find live-sky-runner.js.
  "live-sky-js": {
    ...liveSkyScenario,
    tsx: false,
    files: [
      "src/components/ui/live-sky.jsx",
      "src/components/ui/live-sky-engine.js",
      "src/components/ui/live-sky-runner.js",
      "src/components/ui/live-sky-worker.js",
    ],
    absent: ["src/components/ui/live-sky.tsx", "src/components/ui/live-sky-runner.ts"],
  },
  "vinyl-scrubber": {
    ...vinylScenario,
    files: [
      "src/components/ui/vinyl-scrubber.tsx",
      "src/components/ui/vinyl-scrubber-stage.ts",
      "src/components/ui/vinyl-scrubber-runner.ts",
      "src/components/ui/vinyl-scrubber-worker.js",
    ],
  },
  "vinyl-scrubber-js": {
    ...vinylScenario,
    tsx: false,
    files: [
      "src/components/ui/vinyl-scrubber.jsx",
      "src/components/ui/vinyl-scrubber-stage.js",
      "src/components/ui/vinyl-scrubber-runner.js",
      "src/components/ui/vinyl-scrubber-worker.js",
    ],
    absent: ["src/components/ui/vinyl-scrubber.tsx", "src/components/ui/vinyl-scrubber-runner.ts"],
  },
  fresh: {
    css: `@layer ui-sdk;\n@import "tailwindcss";\n`,
    items: allItems,
    main: everythingMain,
    builtCss: [
      '[data-theme="compact"]',
      '[data-theme="glass"]',
      '[data-board-density="auto"]',
      '[data-density="compact"]',
      '[data-radius="md"]',
      ".h-control{",
      ".backdrop-surface{",
      "--glass-opacity",
      "--brand",
      '[data-palette="blue"]',
      "oklch(from var(--brand)",
      "Geist Variable",
      "Geist Mono Variable",
      ".text-title{",
      ".narrow\\:text-title{",
    ],
    fonts: true,
    check: checkEverything,
  },
  init: {
    css: `@layer ui-sdk;\n${readFileSync(join(repo, "tooling", "fixtures", "shadcn-init-neutral.css"), "utf8")}\n`,
    seed: { "src/lib/utils.ts": 'export { cn } from "cn"\n' },
    dependencies: ["tw-animate-css", "cn"],
    devDependencies: ["prettier"],
    items: ["theme", "theme-glass", "font-geist", "tone"],
    addTwice: true,
    format: true,
    main: themeOnlyMain,
    builtCss: ["--brand", "oklch(from var(--brand)", "Geist Variable", ".text-title{"],
    fonts: true,
    check: async () => {},
  },
  layouts: {
    css: `@layer ui-sdk;
@import "tailwindcss";
`,
    items: ["theme", "master-detail", "dashboard-grid", "settings-page", "list-item", "switch", "description-list"],
    main: layoutsMain,
    builtCss: ["@container", ".text-title{"],
    check: checkLayouts,
  },
  lint: {
    css: `@layer ui-sdk;\n@import "tailwindcss";\n`,
    items: ["lint-rules", ...itemsWithCode],
    lintOnly: true,
  },
  aliases: {
    css: `@layer ui-sdk;\n@import "tailwindcss";\n`,
    alias: "~",
    items: ["theme", "badge", "alert", "appearance", "agent-task-board", "data-table", "chart", "relative-time"],
    skills: ["eskais-ui-skill", "eskais-mockup-skill", "eskais-perf-skill"],
    main: aliasesMain,
    builtCss: ["--brand", ".text-title{"],
    check: async () => {},
    files: [
      "src/lib/utils.ts",
      "src/lib/tone.ts",
      "src/lib/agent-task-board-model.ts",
      "src/lib/data-table-model.ts",
      "src/lib/chart-config.ts",
      "src/lib/time.ts",
      "src/components/ui/badge.tsx",
      "src/components/ui/agent-task-board-primitive.ts",
    ],
  },
  imports: {
    css: `@layer ui-sdk;
@import "tailwindcss";
`,
    imports: {
      "#components/*": "./src/components/*",
      "#ui/*": "./src/components/ui/*",
      "#lib/*": "./src/lib/*",
      "#hooks/*": "./src/hooks/*",
    },
    aliases: { components: "#components", ui: "#ui", utils: "#lib/utils", lib: "#lib", hooks: "#hooks" },
    rewrite: (source) =>
      source
        .replaceAll(/from "@\/components\/ui\/(form-messages)"/g, 'from "#ui/$1.ts"')
        .replaceAll(/from "@\/components\/ui\/([\w-]+)"/g, 'from "#ui/$1.tsx"')
        .replaceAll(/from "@\/lib\/([\w-]+)"/g, 'from "#lib/$1.ts"'),
    dependencies: ["zod"],
    items: ["theme", "badge", "alert", "toast", "form"],
    main: importsMain,
    builtCss: ["--brand", ".text-title{"],
    check: async () => {},
    literals: ["@", "#components", "#ui", "#lib"],
    files: [
      "src/lib/utils.ts",
      "src/lib/tone.ts",
      "src/components/ui/badge.tsx",
      "src/components/ui/toast.tsx",
      "src/components/ui/form-context.ts",
    ],
  },
  "imports-flat": {
    css: `@layer ui-sdk;
@import "tailwindcss";
`,
    imports: {
      "#components/*": "./src/components/*",
      "#ui/*": "./src/components/*",
      "#lib/*": "./src/lib/*",
      "#hooks/*": "./src/hooks/*",
    },
    aliases: { components: "#components", ui: "#ui", utils: "#lib/utils", lib: "#lib", hooks: "#hooks" },
    rewrite: (source) =>
      source
        .replaceAll(/from "@\/components\/ui\/(form-messages)"/g, 'from "#ui/$1.ts"')
        .replaceAll(/from "@\/components\/ui\/([\w-]+)"/g, 'from "#ui/$1.tsx"')
        .replaceAll(/from "@\/lib\/([\w-]+)"/g, 'from "#lib/$1.ts"'),
    dependencies: ["zod"],
    items: ["theme", "badge", "alert", "toast", "form"],
    main: importsMain,
    builtCss: ["--brand", ".text-title{"],
    check: async () => {},
    literals: ["@", "#components", "#ui", "#lib"],
    files: [
      "src/lib/utils.ts",
      "src/components/badge.tsx",
      "src/components/toast.tsx",
      "src/components/form-context.ts",
    ],
    absent: ["src/components/ui"],
    writes: { file: "src/components/form-actions.tsx", specifier: 'from "#components/form-context.ts"' },
  },
  // Workaround: shadcn writes `#ui/components/form-context` without an extension under a mapping that appends `.tsx`,
  // and `ui` holds `.ts` files too; kept so the README's advice stays true.
  "imports-tsx": {
    unsupported: {
      file: "src/components/ui/form-actions.tsx",
      specifier: 'from "#ui/components/form-context"',
    },
    css: `@layer ui-sdk;
@import "tailwindcss";
`,
    imports: {
      "#components/*": "./src/components/*.tsx",
      "#ui/components/*": "./src/components/ui/*.tsx",
      "#lib/*": "./src/lib/*.ts",
      "#hooks/*": "./src/hooks/*.ts",
    },
    aliases: { components: "#components", ui: "#ui/components", utils: "#lib/utils", lib: "#lib", hooks: "#hooks" },
    rewrite: (source) =>
      source
        .replaceAll(/from "@\/components\/ui\//g, 'from "#ui/components/')
        .replaceAll(/from "@\/lib\//g, 'from "#lib/'),
    dependencies: ["zod"],
    items: ["theme", "badge", "alert", "toast", "form"],
    main: importsMain,
    builtCss: ["--brand", ".text-title{"],
    check: async () => {},
    literals: ["@", "#components", "#ui", "#lib"],
    files: ["src/components/ui/form-context.ts"],
  },
  "server-data": {
    css: `@layer ui-sdk;
@import "tailwindcss";
`,
    items: ["theme", "server-data-table", "server-list", "server-combobox", "filter-rsql"],
    main: serverDataMain,
    builtCss: ["--brand", ".text-title{"],
    check: checkServerData,
    literals: ["@"],
    files: ["src/lib/filter-schema.ts", "src/lib/filter-rsql.ts", "src/lib/page-source.ts", "src/lib/array-source.ts"],
    absent: [
      "src/lib/filter-odata.ts",
      "src/lib/filter-spring.ts",
      "src/lib/filter-graphql.ts",
      "src/lib/page-source-rest.ts",
      "src/lib/page-source-spring.ts",
      "src/lib/page-source-cursor.ts",
      "src/lib/page-source-relay.ts",
      "src/lib/page-source-link.ts",
    ],
  },
  "release-age": {
    packageManagers: ["pnpm", "bun"],
    releaseAge: {
      minutes: 7 * 24 * 60,
      exclude: [...Object.keys(youngDependencyExceptions), ...devDependencies],
    },
    css: `@layer ui-sdk;\n@import "tailwindcss";\n`,
    items: ["theme", "dialog"],
    main: releaseAgeMain,
    builtCss: ["--brand", ".text-title{"],
    check: checkLucideIcon,
  },
  "mockup-cli": {
    css: `@layer ui-sdk;
@import "tailwindcss";
`,
    items: ["theme", "button", "card"],
    skills: ["eskais-mockup-skill", "eskais-mockup-cli"],
    main: mockupCliMain,
    builtCss: ["--brand", ".text-title{"],
    check: async () => {},
    mockup: true,
  },
  liquid: {
    css: `@layer ui-sdk;
@import "tailwindcss";
`,
    items: ["theme", "theme-liquid", "liquid-lens", "button"],
    addTwice: true,
    main: liquidMain,
    builtCss: [
      '[data-theme="liquid"]',
      ".glass-control{",
      ".glass-control-edge{",
      "--glass-rim-light",
      "#eskais-liquid-lens",
    ],
    check: checkLiquid,
  },
  "existing-lucide": {
    dependencies: ["lucide-react"],
    dependencySpecs: { "class-variance-authority": "^0.7.1" },
    css: `@layer ui-sdk;\n@import "tailwindcss";\n`,
    items: ["theme", "dialog"],
    main: releaseAgeMain,
    builtCss: ["--brand", ".text-title{"],
    check: checkLucideIcon,
  },
}

async function checkLucideIcon(page) {
  const icon = await page.locator('[data-slot="button"][aria-label="Close"] svg.lucide').count()
  if (icon !== 1) throw new Error("The lucide icon didn't render in the button")
}

const compareVersions = (a, b) => {
  const [x, y] = [a, b].map((version) => version.split(".").map(Number))
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]
}

function checkLucideDependency(app, scenario) {
  const spec = JSON.parse(readFileSync(join(app, "package.json"), "utf8")).dependencies?.["lucide-react"]
  const manifest = join(app, "node_modules", "lucide-react", "package.json")
  const installed = existsSync(manifest) ? JSON.parse(readFileSync(manifest, "utf8")).version : undefined
  if (spec === undefined && installed === undefined) return
  const floor = unversionedDependencies["lucide-react"]
  const had = (scenario.dependencies ?? []).includes("lucide-react")
  const expected = had ? versions["lucide-react"] : installed === undefined ? undefined : `^${installed}`
  if (spec !== expected || installed === undefined || (had && installed !== versions["lucide-react"]))
    throw new Error(`lucide-react: package.json has ${String(spec)} and ${String(installed)} is installed`)
  if (compareVersions(installed, floor) < 0) throw new Error(`lucide-react ${installed} is older than ${floor}`)
  console.log(`lucide-react: package.json ${spec}, installed ${installed} (floor ${floor})`)
}

const pinnedSpec = (version, had) => (pm === "npm" ? `^${version}` : pm === "pnpm" ? (had ?? version) : version)

function checkPins(app, scenario) {
  const specs = JSON.parse(readFileSync(join(app, "package.json"), "utf8")).dependencies ?? {}
  const pins = new Set()
  const seen = new Set()
  const visit = (item) => {
    if (seen.has(item)) return
    seen.add(item)
    const { dependencies = [], registryDependencies = [] } = JSON.parse(
      readFileSync(join(registryDir, `${item}.json`), "utf8"),
    )
    for (const dependency of dependencies) pins.add(dependency)
    for (const name of registryDependencies) visit(name.replace(/^@eskais\//, ""))
  }
  for (const item of scenario.items) visit(item)
  for (const dependency of pins) {
    const at = dependency.lastIndexOf("@")
    if (at <= 0) continue
    const [name, version] = [dependency.slice(0, at), dependency.slice(at + 1)]
    const had = scenario.dependencySpecs?.[name]
    const expected = pm === "npm" && had ? had : pinnedSpec(version, had)
    // Workaround: pnpm 12 kept a consumer's own range on Windows and wrote the pin over it on the Linux CI, so accept
    // either for a dependency the consumer already had.
    const accepted = pm === "pnpm" && had ? [had, version] : [expected]
    if (!accepted.includes(specs[name])) {
      throw new Error(`${name}: package.json has ${String(specs[name])}, expected ${expected} for ${dependency}`)
    }
  }
  const shown = ["@ui-sdk/core", "@ui-sdk/react", ...Object.keys(scenario.dependencySpecs ?? {})]
  console.log(`pins: ${shown.map((name) => `${name} ${String(specs[name])}`).join(", ")}`)
}

function checkPlacement(app, scenario) {
  for (const file of scenario.files) if (!existsSync(join(app, file))) throw new Error(`shadcn didn't write ${file}`)
  for (const path of scenario.absent ?? []) if (existsSync(join(app, path))) throw new Error(`shadcn wrote ${path}`)
  if (scenario.writes) {
    const { file, specifier } = scenario.writes
    if (!readFileSync(join(app, file), "utf8").includes(specifier)) throw new Error(`${file} lacks ${specifier}`)
  }
  for (const literal of scenario.literals ?? ["@", scenario.alias]) {
    if (existsSync(join(app, literal))) throw new Error(`shadcn wrote files into a literal "${literal}" folder`)
  }
  if (!scenario.alias && !scenario.aliases) return
  const sources = readdirSync(join(app, "src"), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.[jt]sx?$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name))
  const stale = sources.filter((file) => readFileSync(file, "utf8").includes('from "@/'))
  if (stale.length > 0) throw new Error(`Imports still point at @/: ${stale.join(", ")}`)
}

function checkSkills(app, names) {
  for (const name of names) {
    const item = JSON.parse(readFileSync(join(registryDir, `${name}.json`), "utf8"))
    for (const file of item.files) {
      if (!/^~\/\.agents\/(skills|tools)\//.test(file.target ?? "")) {
        throw new Error(`${name}: ${file.path} targets ${file.target}`)
      }
      const path = join(app, file.target.slice(2))
      if (!existsSync(path)) throw new Error(`shadcn didn't write ${file.target} for ${name}`)
      if (readFileSync(path, "utf8") !== file.content) throw new Error(`${file.target} differs from ${file.path}`)
    }
    console.log(`${name}: ${item.files.length} files in ${dirname(item.files[0].target.slice(2))}`)
  }
}

function captured(app, command, args) {
  return new Promise((done) => {
    console.log(`$ ${command} ${args.join(" ")}`)
    let output = ""
    const child = spawn(command, args, { cwd: app, shell: process.platform === "win32" })
    child.stdout.on("data", (chunk) => (output += chunk))
    child.stderr.on("data", (chunk) => (output += chunk))
    child.on("exit", (code) => done({ code, output }))
  })
}

async function checkInstalledLint(app) {
  writeFileSync(
    join(app, ".oxlintrc.json"),
    JSON.stringify({ extends: ["./eskais-ui.oxlintrc.json"], options: { reportUnusedDisableDirectives: "error" } }),
  )
  const [command, ...prefix] = pm === "pnpm" ? ["pnpm", "exec"] : [pm === "npm" ? "npx" : "bunx"]
  const { output } = await captured(app, command, [...prefix, "oxlint", "--format", "default", "src"])
  const linted = /Finished in .* on (\d+) files/.exec(output)
  if (!linted || Number(linted[1]) === 0) throw new Error(`oxlint didn't lint the installed files:\n${output}`)
  const unused = output.split("Unused oxlint-disable directive").length - 1
  if (unused > 0) throw new Error(`The installed files carry ${String(unused)} unused disable directives:\n${output}`)
  const found = /Found (\d+) warnings? and (\d+) errors?/.exec(output)
  if (!found || found[2] !== "0")
    throw new Error(`The consumer preset reports errors in the installed files:\n${output}`)
  console.log(
    `lint: no error and no unused disable directive in the ${linted[1]} installed files (${found[1]} warnings)`,
  )
}

async function checkMockupCli(app, run) {
  if (spawnSync("bun", ["--version"], { shell: process.platform === "win32" }).status !== 0) {
    console.log("mockup-cli: no Bun on this machine, so the CLI didn't run")
    return
  }
  const cli = ".agents/tools/eskais-mockup/cli.ts"
  const { version } = JSON.parse(readFileSync(join(repo, "package.json"), "utf8"))
  const printed = spawnSync("bun", [cli, "--version"], { cwd: app, encoding: "utf8" }).stdout.trim()
  if (printed !== `eskais-mockup ${version}`) throw new Error(`The CLI printed "${printed}" for --version`)
  await run("bun", [cli, "inspect", "Button", "Card"])
  mkdirSync(join(app, ".mockups", "hello"), { recursive: true })
  writeFileSync(join(app, ".mockups", "hello", "screen.tsx"), helloScreen)
  await run("bun", [cli, "validate", "hello"])
  if (!readFileSync(join(app, ".mockups", "hello", "out.html"), "utf8").includes('<div id="root"></div>')) {
    throw new Error("validate didn't write .mockups/hello/out.html")
  }
}

const requested = process.argv.slice(3)
for (const name of requested) if (!scenarios[name]) throw new Error(`Unknown scenario: ${name}`)

// Perf: async on purpose: a sync child would block the event loop and starve the registry server above.
function runner(app) {
  return (command, args) =>
    new Promise((done, fail) => {
      console.log(`$ ${command} ${args.join(" ")}`)
      spawn(command, args, {
        cwd: app,
        stdio: ["ignore", "inherit", "inherit"],
        shell: process.platform === "win32",
      }).on("exit", (code) =>
        code === 0 ? done() : fail(new Error(`${command} ${args.join(" ")} exited with ${code}`)),
      )
    })
}

async function runScenario(name, scenario) {
  const app = mkdtempSync(join(tmpdir(), `eskais-consumer-${pm}-${name}-`))
  console.log(`\n== ${name} scenario in ${app}`)
  const write = (path, content) => {
    mkdirSync(dirname(join(app, path)), { recursive: true })
    writeFileSync(join(app, path), typeof content === "string" ? content : JSON.stringify(content, null, 2))
  }
  const run = runner(app)
  const alias = scenario.alias ?? "@"
  const exec = (args) => (pm === "pnpm" ? run("pnpm", ["exec", ...args]) : run(pm === "npm" ? "npx" : "bunx", args))
  write("package.json", {
    name: "eskais-consumer",
    private: true,
    type: "module",
    dependencies: { ...pick(["react", "react-dom", ...(scenario.dependencies ?? [])]), ...scenario.dependencySpecs },
    devDependencies: pick([...devDependencies, ...(scenario.devDependencies ?? [])]),
    ...(scenario.imports && { imports: scenario.imports }),
  })
  write("tsconfig.json", {
    compilerOptions: {
      target: "ES2024",
      lib: ["ES2024", "DOM", "DOM.Iterable"],
      module: "ESNext",
      moduleResolution: "Bundler",
      jsx: "react-jsx",
      strict: true,
      noUncheckedIndexedAccess: true,
      skipLibCheck: true,
      noEmit: true,
      types: ["vite/client"],
      ...(scenario.imports ? { allowImportingTsExtensions: true } : { paths: { [`${alias}/*`]: ["./src/*"] } }),
    },
    include: ["src"],
  })
  write(
    "vite.config.ts",
    `import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  ${scenario.imports ? "" : `resolve: { alias: { "${alias}": fileURLToPath(new URL("./src", import.meta.url)) } },`}
})
`,
  )
  const typescript = scenario.tsx !== false
  const mainFile = typescript ? "src/main.tsx" : "src/main.jsx"
  write(
    "index.html",
    `<!doctype html><html lang="en"><body><div id="root"></div><script type="module" src="/${mainFile}"></script></body></html>`,
  )
  write("src/index.css", scenario.css)
  for (const [path, content] of Object.entries(scenario.seed ?? {})) write(path, content)
  write("components.json", {
    $schema: "https://ui.shadcn.com/schema.json",
    style: "new-york",
    rsc: false,
    tsx: typescript,
    tailwind: { config: "", css: "src/index.css", baseColor: "neutral", cssVariables: true },
    aliases: scenario.aliases ?? {
      components: `${alias}/components`,
      ui: `${alias}/components/ui`,
      utils: `${alias}/lib/utils`,
      lib: `${alias}/lib`,
      hooks: `${alias}/hooks`,
    },
    registries: { "@eskais": `http://127.0.0.1:${port}/{name}.json` },
  })

  // Spec: pnpm 11 refuses packages younger than its minimumReleaseAge (a day by default); UI SDK betas are days old.
  const { releaseAge } = scenario
  if (pm === "pnpm")
    write(
      "pnpm-workspace.yaml",
      releaseAge
        ? `minimumReleaseAge: ${String(releaseAge.minutes)}\nminimumReleaseAgeExclude:\n${releaseAge.exclude
            .map((spec) => `  - "${spec}"\n`)
            .join("")}`
        : "minimumReleaseAge: 0\n",
    )
  // Spec: Bun sets no minimum by default, and its excludes are package names, so an exception covers every version.
  if (pm === "bun" && releaseAge) {
    const names = releaseAge.exclude.map((spec) => spec.replace(/(?<=.)@[^@]*$/, ""))
    write(
      "bunfig.toml",
      `[install]\nminimumReleaseAge = ${String(releaseAge.minutes * 60)}\nminimumReleaseAgeExcludes = ${JSON.stringify(names)}\n`,
    )
  }
  await run(pm, ["install"])
  const items = [...scenario.items, ...(scenario.skills ?? [])]
  const add = () => exec(["shadcn", "add", ...items.map((item) => `@eskais/${item}`), "--yes", "--overwrite"])
  await add()
  checkLucideDependency(app, scenario)
  checkPins(app, scenario)
  const readStylesheet = () => readFileSync(join(app, "src", "index.css"), "utf8")
  checkStylesheet(readStylesheet())
  const addAgain = async (message, format = async () => {}) => {
    const before = readStylesheet()
    await add()
    await format()
    if (readStylesheet() === before) return
    writeFileSync(join(app, "src", "index.before.css"), before)
    throw new Error(`${message} (before: src/index.before.css in ${app})`)
  }
  if (scenario.addTwice) await addAgain("Adding the same items again changed the stylesheet")
  if (scenario.format) {
    const prettier = () => exec(["prettier", "--write", "src/index.css"])
    await prettier()
    // Workaround: shadcn writes back every declaration it owns unformatted, so the file only matches once formatted again.
    await addAgain("Adding the items to a formatted stylesheet added rules", prettier)
  }

  if (scenario.files) checkPlacement(app, scenario)
  if (scenario.skills) checkSkills(app, scenario.skills)
  if (scenario.lintOnly) {
    await checkInstalledLint(app)
    console.log(`Consumer check (${name}) passed with ${pm} in ${app}`)
    return
  }
  write(mainFile, scenario.rewrite?.(scenario.main) ?? scenario.main.replaceAll('from "@/', `from "${alias}/`))
  if (scenario.unsupported) {
    const { file, specifier } = scenario.unsupported
    if (!readFileSync(join(app, file), "utf8").includes(specifier)) throw new Error(`${file} lacks ${specifier}`)
    const failed = await exec(["tsc", "--noEmit"]).then(
      () => false,
      () => true,
    )
    if (!failed) throw new Error(`The ${name} mapping type-checked; update the README's advice`)
    console.log(`Consumer check (${name}) failed to type-check, as the README says, with ${pm} in ${app}`)
    return
  }
  if (typescript) await exec(["tsc", "--noEmit"])
  await exec(["vite", "build"])
  const assets = join(app, "dist", "assets")
  const css = readdirSync(assets)
    .filter((file) => file.endsWith(".css"))
    .map((file) => readFileSync(join(assets, file), "utf8"))
    .join("")
  checkBuiltCss(css, scenario.builtCss)
  if (scenario.fonts) {
    if (!readdirSync(assets).some((file) => /^geist-latin-wght-normal.*\.woff2$/.test(file))) {
      throw new Error("The build doesn't ship the Geist woff2 files")
    }
    if (!readdirSync(assets).some((file) => /^geist-mono-latin-wght-normal.*\.woff2$/.test(file))) {
      throw new Error("The build doesn't ship the Geist Mono woff2 files")
    }
  }
  await withPage(join(app, "dist"), scenario.check)
  if (scenario.mockup) await checkMockupCli(app, run)
  console.log(`Consumer check (${name}) passed with ${pm} in ${app}`)
}

try {
  const selected = Object.entries(scenarios).filter(([name, scenario]) => {
    if (requested.length > 0 && !requested.includes(name)) return false
    if (!scenario.packageManagers || scenario.packageManagers.includes(pm)) return true
    console.log(`\n== ${name} scenario skipped: it runs with ${scenario.packageManagers.join(", ")} only`)
    return false
  })
  await selected.reduce(
    (previous, [name, scenario]) => previous.then(() => runScenario(name, scenario)),
    Promise.resolve(),
  )
} finally {
  server.close()
}
