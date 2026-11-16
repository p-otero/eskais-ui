// Installs registry items into fresh Vite apps with npm or pnpm (no Bun), builds them and checks them in Chrome.
// Usage: node tooling/consumer-check.mjs [npm|pnpm] [fresh|init|aliases|imports…] (default: all). `fresh`: every item
// on `@import "tailwindcss"`; `init`: the theme items on the stylesheet `shadcn init` writes (tooling/fixtures);
// `aliases`: `~/` aliases; `imports`: `#ui/*` through package.json `imports` instead of tsconfig paths.
import { spawn } from "node:child_process"
import { createReadStream, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { createServer } from "node:http"
import { tmpdir } from "node:os"
import { dirname, extname, join, normalize, resolve } from "node:path"

import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"

const pm = process.argv[2] ?? "npm"
if (pm !== "npm" && pm !== "pnpm") throw new Error(`Unsupported package manager: ${pm}`)

const repo = resolve(import.meta.dirname, "..")
const registryDir = join(repo, "public", "r")
const allItems = [
  "utils",
  "tone",
  "test-utils",
  "theme",
  "theme-compact",
  "theme-glass",
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
  "quantity",
  "relative-time",
  "acceptance-list",
  "stat",
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

// Elements every scenario renders, read by checkProbes.
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

// What the theme guarantees in any consumer, whatever the stylesheet started as.
async function checkProbes(page) {
  const color = (probe) =>
    page.evaluate((name) => getComputedStyle(document.querySelector(`[data-probe="${name}"]`)).backgroundColor, probe)
  // Let colour-scheme listeners (an app's appearance helper) run first, so they can't undo the attributes set here.
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
  // The default palette's brand is a near-black grey; links must still have a hue of their own.
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

// Every item: the bundled font is in use, the seeds drive the derived colours and the spacing roles resolve.
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
    return {
      markdown: document.querySelector(".cm-line[data-md-heading]")?.textContent,
      border: { card: rgb(card.borderTopColor), token: rgb(getComputedStyle(html).getPropertyValue("--border")) },
      spacing: { compact: compactSpacing, default: defaultSpacing },
      font: [...document.fonts].some((font) => font.family.includes("Geist") && font.status === "loaded"),
      neutral,
      blue,
      yellow,
    }
  })
  console.log("In Chrome:", JSON.stringify(result))
  if (result.markdown !== "Notes") throw new Error(`MarkdownEditor didn't render its heading: ${result.markdown}`)
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

// The rules directly inside a block, given the text after its `{`. shadcn indents nested rules like top-level ones.
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

// The global stylesheet after `shadcn add`, before Tailwind compiles it.
function checkStylesheet(css) {
  const darkVariants = css.match(/^@custom-variant dark\b.*$/gm) ?? []
  // shadcn adds its one-line variant to any file without a custom variant; Tailwind keeps the last definition.
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

const everythingMain = `import { createRoot } from "react-dom/client"
import { AgentTaskBoard } from "@/components/ui/agent-task-board"
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
import { PageHeader } from "@/components/ui/page-header"
import { PageLayout } from "@/components/ui/page-layout"
import { SearchField } from "@/components/ui/search-field"
import { MobileNav } from "@/components/ui/mobile-nav"
import { MarkdownEditor } from "@/components/ui/markdown-editor"
import { markdownCodeLanguages } from "@/components/ui/markdown-editor-languages"
import { MarkdownView } from "@/components/ui/markdown-view"
import { Section } from "@/components/ui/section"
import { SiteHeader } from "@/components/ui/site-header"
import { SkipLink } from "@/components/ui/skip-link"
import { Topbar } from "@/components/ui/topbar"
import { Spinner } from "@/components/ui/spinner"
import { StatusDot } from "@/components/ui/status-pill"
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
    <Card data-theme="glass">
      <CardHeader><CardTitle className="narrow:text-title">Consumer</CardTitle></CardHeader>
      <CardContent>
        <Badge variant="success">Ready</Badge>
        <Badge tone="warning">Stale</Badge>
        <StatusDot tone="success" label="Online" pulse />
        <Button onClick={() => Promise.resolve()}>Save</Button>
        <Button loading>Saving</Button>
        <Field><FieldLabel>Name</FieldLabel><Input /></Field>
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
    <Probes />
    </PageLayout>
    <MobileNav label="Phone" items={[{ label: "Home", href: "/", icon: <span aria-hidden="true">H</span>, current: true }]} />
    </Appearance>
  )
}

createRoot(document.getElementById("root")!).render(<App />)
`

// Only the theme items, in a stylesheet that shadcn init wrote first, with plain elements styled by the tokens.
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

// Components that pull registry:lib files, imported through the scenario's alias.
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

// A few items with registry:lib files, imported through package.json subpath imports.
const importsMain = `import { createRoot } from "react-dom/client"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { ToastStack } from "@/components/ui/toast"
import { cn } from "@/lib/utils"
import "./index.css"
${probes}
function App() {
  return (
    <main className="flex flex-col gap-items p-inset-surface">
      <Badge tone="violet">Design</Badge>
      <Alert tone="info"><AlertTitle>Queued</AlertTitle></Alert>
      <ToastStack labels={{ close: "Dismiss" }} />
      <Probes />
    </main>
  )
}

createRoot(document.getElementById("root")!).render(<App />)
`

const scenarios = {
  fresh: {
    css: `@layer ui-sdk;\n@import "tailwindcss";\n`,
    items: allItems,
    main: everythingMain,
    builtCss: [
      '[data-theme="compact"]',
      '[data-theme="glass"]',
      '[data-density="auto"]',
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
    // What `shadcn init` writes with base colour neutral (shadcn 4.23.0), plus the line the install docs ask for.
    css: `@layer ui-sdk;\n${readFileSync(join(repo, "tooling", "fixtures", "shadcn-init-neutral.css"), "utf8")}\n`,
    seed: { "src/lib/utils.ts": 'export { cn } from "cn"\n' },
    dependencies: ["tw-animate-css", "cn"],
    devDependencies: ["prettier"],
    items: ["theme", "theme-glass", "font-geist", "tone"],
    addTwice: true,
    // Then the consumer's formatter rewrites the stylesheet, and another add must still find every rule.
    format: true,
    main: themeOnlyMain,
    builtCss: ["--brand", "oklch(from var(--brand)", "Geist Variable", ".text-title{"],
    fonts: true,
    check: async () => {},
  },
  aliases: {
    css: `@layer ui-sdk;\n@import "tailwindcss";\n`,
    // Not `@/`: shadcn places registry:lib and registry:ui files through these aliases and rewrites imports to them.
    alias: "~",
    items: ["theme", "badge", "alert", "appearance", "agent-task-board", "data-table", "chart", "relative-time"],
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
    // Subpath imports in package.json instead of tsconfig paths and a Vite alias: TypeScript, Vite and shadcn read them.
    imports: {
      "#components/*": "./src/components/*",
      "#ui/*": "./src/components/ui/*",
      "#lib/*": "./src/lib/*",
      "#hooks/*": "./src/hooks/*",
    },
    aliases: { components: "#components", ui: "#ui", utils: "#lib/utils", lib: "#lib", hooks: "#hooks" },
    // shadcn writes these imports with their .ts and .tsx extensions, as Node resolves subpath imports.
    rewrite: (source) =>
      source
        .replaceAll(/from "@\/components\/ui\/([\w-]+)"/g, 'from "#ui/$1.tsx"')
        .replaceAll(/from "@\/lib\/([\w-]+)"/g, 'from "#lib/$1.ts"'),
    items: ["theme", "badge", "alert", "toast"],
    main: importsMain,
    builtCss: ["--brand", ".text-title{"],
    check: async () => {},
    literals: ["@", "#components", "#ui", "#lib"],
    files: ["src/lib/utils.ts", "src/lib/tone.ts", "src/components/ui/badge.tsx", "src/components/ui/toast.tsx"],
  },
}

// Where shadcn put the files and what the imports point at, for a scenario with its own aliases.
function checkPlacement(app, scenario) {
  for (const file of scenario.files) if (!existsSync(join(app, file))) throw new Error(`shadcn didn't write ${file}`)
  for (const literal of scenario.literals ?? ["@", scenario.alias]) {
    if (existsSync(join(app, literal))) throw new Error(`shadcn wrote files into a literal "${literal}" folder`)
  }
  const sources = readdirSync(join(app, "src"), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /.tsx?$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name))
  const stale = sources.filter((file) => readFileSync(file, "utf8").includes('from "@/'))
  if (stale.length > 0) throw new Error(`Imports still point at @/: ${stale.join(", ")}`)
}

const requested = process.argv.slice(3)
for (const name of requested) if (!scenarios[name]) throw new Error(`Unknown scenario: ${name}`)

// Async on purpose: a sync child would block the event loop and starve the registry server above.
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
  const exec = (args) => run(pm === "npm" ? "npx" : "pnpm", [...(pm === "npm" ? [] : ["exec"]), ...args])
  write("package.json", {
    name: "eskais-consumer",
    private: true,
    type: "module",
    dependencies: pick(["react", "react-dom", ...(scenario.dependencies ?? [])]),
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
  write(
    "index.html",
    `<!doctype html><html lang="en"><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>`,
  )
  write("src/index.css", scenario.css)
  for (const [path, content] of Object.entries(scenario.seed ?? {})) write(path, content)
  write("components.json", {
    $schema: "https://ui.shadcn.com/schema.json",
    style: "new-york",
    rsc: false,
    tsx: true,
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

  // pnpm 11 refuses packages younger than its minimumReleaseAge; UI SDK betas are days old.
  if (pm === "pnpm") write("pnpm-workspace.yaml", "minimumReleaseAge: 0\n")
  await run(pm, ["install"])
  const add = () => exec(["shadcn", "add", ...scenario.items.map((item) => `@eskais/${item}`), "--yes", "--overwrite"])
  await add()
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
    // shadcn writes back every declaration it owns unformatted, so the file only matches once formatted again.
    await addAgain("Adding the items to a formatted stylesheet added rules", prettier)
  }

  if (scenario.files) checkPlacement(app, scenario)
  write("src/main.tsx", scenario.rewrite?.(scenario.main) ?? scenario.main.replaceAll('from "@/', `from "${alias}/`))
  await exec(["tsc", "--noEmit"])
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
  console.log(`Consumer check (${name}) passed with ${pm} in ${app}`)
}

try {
  const selected = Object.entries(scenarios).filter(([name]) => requested.length === 0 || requested.includes(name))
  // One at a time: each scenario installs packages and launches Chrome, and the logs stay readable.
  await selected.reduce(
    (previous, [name, scenario]) => previous.then(() => runScenario(name, scenario)),
    Promise.resolve(),
  )
} finally {
  server.close()
}
