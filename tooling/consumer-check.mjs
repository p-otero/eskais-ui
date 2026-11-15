// Installs every registry item into a fresh Vite app with npm or pnpm (no Bun) and builds it.
// Usage: node tooling/consumer-check.mjs [npm|pnpm]
import { spawn } from "node:child_process"
import { createReadStream, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { createServer } from "node:http"
import { tmpdir } from "node:os"
import { join, normalize, resolve } from "node:path"

const pm = process.argv[2] ?? "npm"
if (pm !== "npm" && pm !== "pnpm") throw new Error(`Unsupported package manager: ${pm}`)

const repo = resolve(import.meta.dirname, "..")
const registryDir = join(repo, "public", "r")
const items = [
  "utils",
  "theme",
  "theme-compact",
  "theme-glass",
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { SearchField } from "@/components/ui/search-field"
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

function App() {
  return (
    <>
    <AgentTaskBoard tasks={tasks} mode="snapshot" generatedAt="2026-11-15T18:42:00Z" timeZone="UTC" />
    <Card data-theme="glass">
      <CardHeader><CardTitle>Consumer</CardTitle></CardHeader>
      <CardContent>
        <Badge variant="success">Ready</Badge>
        <Button onClick={() => Promise.resolve()}>Save</Button>
        <Field><FieldLabel>Name</FieldLabel><Input /></Field>
        <SearchField label="Search" onSearch={() => {}} />
        <Dialog><DialogTrigger>Open</DialogTrigger><DialogContent><DialogTitle>Hi</DialogTitle></DialogContent></Dialog>
        <ConfirmDialog trigger="Delete" title="Delete?" confirmLabel="Delete" tone="destructive" agentConfirm="Deletes it" onConfirm={() => {}} />
      </CardContent>
    </Card>
    </>
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
    ".h-control{",
    ".backdrop-surface{",
    "--glass-opacity",
  ]) {
    if (!css.includes(expected) && !css.includes(expected.replaceAll('"', ""))) {
      throw new Error(`Built CSS is missing ${expected}`)
    }
  }
  console.log(`Consumer check passed with ${pm} in ${app}`)
} finally {
  server.close()
}
