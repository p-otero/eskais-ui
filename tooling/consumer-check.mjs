// Installs every registry item into a fresh Vite app with npm or pnpm (no Bun) and builds it.
// Usage: node tooling/consumer-check.mjs [npm|pnpm]
import { spawn } from "node:child_process"
import { createReadStream, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { createServer } from "node:http"
import { tmpdir } from "node:os"
import { extname, join, normalize, resolve } from "node:path"

import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"

const pm = process.argv[2] ?? "npm"
if (pm !== "npm" && pm !== "pnpm") throw new Error(`Unsupported package manager: ${pm}`)

const repo = resolve(import.meta.dirname, "..")
const registryDir = join(repo, "public", "r")
const items = [
  "utils",
  "tone",
  "theme",
  "theme-compact",
  "theme-glass",
  "palettes",
  "font-geist",
  "appearance",
  "button",
  "field",
  "input",
  "search-field",
  "dialog",
  "confirm-dialog",
  "card",
  "badge",
  "tabs",
  "collapsible",
  "scroll-area",
  "separator",
  "avatar",
  "skeleton",
  "empty",
  "kbd",
  "table",
  "tooltip",
  "popover",
  "drawer",
  "dropdown-menu",
  "toast",
  "select",
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
  "carousel",
  "resizable",
  "sidebar",
  "data-table",
  "page-header",
  "filter-bar",
  "chart",
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
}

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

// Loads the built app in Chrome: the bundled font is in use, and the seeds drive the derived colors.
// Playwright comes from the consumer app's own install, so this script runs with Node alone (no repo install).
async function checkInBrowser(dist) {
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
    await page.getByRole("button", { name: "Save" }).waitFor()
    await page.addStyleTag({ content: "*, ::before, ::after { transition: none !important; }" })
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
        border: { card: rgb(card.borderTopColor), token: rgb(getComputedStyle(html).getPropertyValue("--border")) },
        spacing: { compact: compactSpacing, default: defaultSpacing },
        font: [...document.fonts].some((font) => font.family.includes("Geist") && font.status === "loaded"),
        neutral,
        blue,
        yellow,
      }
    })
    console.log("In Chrome:", JSON.stringify(result))
    if (result.border.card !== result.border.token) throw new Error("Borders don't use --border")
    if (!result.font) throw new Error("The Geist font didn't load in the built app")
    if (result.blue.background === result.neutral.background) throw new Error("data-palette didn't change --primary")
    if (result.yellow.text === result.neutral.text)
      throw new Error("--primary-foreground didn't follow a light --brand")
    const expected = {
      compact: { button: "4px", badge: "6px 2px", card: "12px" },
      default: { button: "6px", badge: "8px 2px", card: "16px" },
    }
    if (JSON.stringify(result.spacing) !== JSON.stringify(expected))
      throw new Error(`The spacing roles didn't resolve: ${JSON.stringify(result.spacing)}`)
  } finally {
    await browser.close()
    site.close()
  }
}

const app = mkdtempSync(join(tmpdir(), `eskais-consumer-${pm}-`))
const write = (path, content) =>
  writeFileSync(join(app, path), typeof content === "string" ? content : JSON.stringify(content, null, 2))
// Async on purpose: a sync child would block the event loop and starve the registry server above.
const run = (command, args) =>
  new Promise((done, fail) => {
    console.log(`$ ${command} ${args.join(" ")}`)
    spawn(command, args, { cwd: app, stdio: ["ignore", "inherit", "inherit"], shell: process.platform === "win32" }).on(
      "exit",
      (code) => (code === 0 ? done() : fail(new Error(`${command} ${args.join(" ")} exited with ${code}`))),
    )
  })

try {
  write("package.json", {
    name: "eskais-consumer",
    private: true,
    type: "module",
    dependencies: { react: versions.react, "react-dom": versions["react-dom"] },
    devDependencies: Object.fromEntries(
      [
        "@types/react",
        "@types/react-dom",
        "vite",
        "@vitejs/plugin-react",
        "tailwindcss",
        "@tailwindcss/vite",
        "typescript",
        "shadcn",
        "playwright",
      ].map((name) => [name, versions[name]]),
    ),
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
      paths: { "@/*": ["./src/*"] },
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
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
})
`,
  )
  write(
    "index.html",
    `<!doctype html><html lang="en"><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>`,
  )
  mkdirSync(join(app, "src"))
  write("src/index.css", `@layer ui-sdk;\n@import "tailwindcss";\n`)
  write("components.json", {
    $schema: "https://ui.shadcn.com/schema.json",
    style: "new-york",
    rsc: false,
    tsx: true,
    tailwind: { config: "", css: "src/index.css", baseColor: "neutral", cssVariables: true },
    aliases: {
      components: "@/components",
      ui: "@/components/ui",
      utils: "@/lib/utils",
      lib: "@/lib",
      hooks: "@/hooks",
    },
    registries: { "@eskais": `http://127.0.0.1:${port}/{name}.json` },
  })

  // pnpm 11 refuses packages younger than its minimumReleaseAge; UI SDK betas are days old.
  if (pm === "pnpm") write("pnpm-workspace.yaml", "minimumReleaseAge: 0\n")
  await run(pm, ["install"])
  await run(pm === "npm" ? "npx" : "pnpm", [
    ...(pm === "npm" ? [] : ["exec"]),
    "shadcn",
    "add",
    ...items.map((item) => `@eskais/${item}`),
    "--yes",
  ])

  write(
    "src/main.tsx",
    `import { createRoot } from "react-dom/client"
import { AgentTaskBoard } from "@/components/ui/agent-task-board"
import { Appearance, createAppearance } from "@/components/ui/appearance"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { SearchField } from "@/components/ui/search-field"
import { StatusDot } from "@/components/ui/status-pill"
import type { TaskView } from "@/lib/agent-task-types"
import "./index.css"

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

const appearance = createAppearance({ theme: "compact" })
appearance.apply()

function App() {
  return (
    <Appearance appearance={appearance}>
    <AgentTaskBoard tasks={tasks} mode="snapshot" generatedAt="2026-11-15T18:42:00Z" timeZone="UTC" />
    <Card data-theme="glass">
      <CardHeader><CardTitle className="narrow:text-title">Consumer</CardTitle></CardHeader>
      <CardContent>
        <Badge variant="success">Ready</Badge>
        <Badge tone="warning">Stale</Badge>
        <StatusDot tone="success" label="Online" pulse />
        <Button onClick={() => Promise.resolve()}>Save</Button>
        <Field><FieldLabel>Name</FieldLabel><Input /></Field>
        <SearchField label="Search" onSearch={() => {}} />
        <Dialog><DialogTrigger>Open</DialogTrigger><DialogContent><DialogTitle>Hi</DialogTitle></DialogContent></Dialog>
        <ConfirmDialog trigger="Delete" title="Delete?" confirmLabel="Delete" tone="destructive" agentConfirm="Deletes it" onConfirm={() => {}} />
      </CardContent>
    </Card>
    </Appearance>
  )
}

createRoot(document.getElementById("root")!).render(<App />)
`,
  )
  await run(pm === "npm" ? "npx" : "pnpm", [...(pm === "npm" ? [] : ["exec"]), "tsc", "--noEmit"])
  await run(pm === "npm" ? "npx" : "pnpm", [...(pm === "npm" ? [] : ["exec"]), "vite", "build"])
  const assets = join(app, "dist", "assets")
  const css = readdirSync(assets)
    .filter((file) => file.endsWith(".css"))
    .map((file) => readFileSync(join(assets, file), "utf8"))
    .join("")
  for (const expected of [
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
  ]) {
    if (!css.includes(expected) && !css.includes(expected.replaceAll('"', ""))) {
      throw new Error(`Built CSS is missing ${expected}`)
    }
  }
  if (!readdirSync(assets).some((file) => /^geist-latin-wght-normal.*\.woff2$/.test(file))) {
    throw new Error("The build doesn't ship the Geist woff2 files")
  }
  if (!readdirSync(assets).some((file) => /^geist-mono-latin-wght-normal.*\.woff2$/.test(file))) {
    throw new Error("The build doesn't ship the Geist Mono woff2 files")
  }
  await checkInBrowser(join(app, "dist"))
  console.log(`Consumer check passed with ${pm} in ${app}`)
} finally {
  server.close()
}
