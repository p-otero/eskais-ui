import type { Quantity } from "@/lib/quantity"
import type { AgentRef, AttemptView, TaskStatus, TaskView, UsageSummary } from "@/lib/agent-task-types"
import type { Attachment } from "@/components/ui/attachments"
import type { Stage } from "@/components/ui/stage-track"

const GENERATED_AT = "2026-11-15T18:42:00Z"

const measured = (value: number): Quantity => ({ value, quality: "measured" })
const estimated = (value: number, source = "price table 2026-11-15"): Quantity => ({
  value,
  quality: "estimated",
  source,
})
const unknown: Quantity = { value: null, quality: "unknown" }

function usage(input: number, output: number, cost: number | null): UsageSummary {
  return {
    inputTokens: measured(input),
    outputTokens: measured(output),
    cacheReadTokens: measured(Math.round(input * 0.6)),
    cacheWriteTokens: unknown,
    reasoningTokens: measured(Math.round(output * 0.4)),
    costUsd: cost === null ? unknown : estimated(cost),
    durationMs: measured(Math.round(input / 3)),
  }
}

const codex: AgentRef = {
  provider: "codex",
  model: "openai-codex/gpt-6.1-terra-preview-2026-11",
  effort: { name: "reasoningEffort", value: "high" },
}
const claude: AgentRef = {
  provider: "claudeAgent",
  model: "claude-opus-5-5",
  effort: { name: "effort", value: "medium" },
  label: "Opus 5.5",
}
const pi: AgentRef = { provider: "pi", model: "zai/glm-5.3", effort: { name: "thinking", value: "high" } }

const sampleStages: Stage[] = [
  { id: "branch", label: "Branch" },
  { id: "pr", label: "Pull request" },
  { id: "dev", label: "In Dev", tone: "info" },
  { id: "staging", label: "In Staging", tone: "warning" },
  { id: "prod", label: "In Prod", tone: "success" },
]

const schemes = {
  light: { page: "#f6f7f9", panel: "#ffffff", line: "#dfe3e8", text: "#1d2330", muted: "#8a93a3" },
  dark: { page: "#11141a", panel: "#1a1f28", line: "#2c333f", text: "#e7eaf0", muted: "#6f7889" },
}

function screen(scheme: keyof typeof schemes, accent: string, rows: number): string {
  const c = schemes[scheme]
  const lines = Array.from(
    { length: rows },
    (_, row) =>
      `<rect x="24" y="${72 + row * 28}" width="${120 + ((row * 53) % 140)}" height="10" rx="5" fill="${row === 1 ? accent : c.muted}"/>`,
  ).join("")
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200"><rect width="320" height="200" fill="${c.page}"/><rect x="12" y="12" width="296" height="176" rx="12" fill="${c.panel}" stroke="${c.line}"/><rect x="24" y="28" width="140" height="14" rx="7" fill="${c.text}"/><rect x="236" y="24" width="60" height="22" rx="6" fill="${accent}"/>${lines}</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

function image(id: string, name: string, alt: string, accent: string, rows: number): Attachment {
  return {
    id,
    name,
    kind: "image",
    alt,
    src: screen("light", accent, rows),
    srcDark: screen("dark", accent, rows),
    mimeType: "image/svg+xml",
  }
}

const searchLog = ["indexing 1204 pages", "retry: quota exhausted", "fallback: codex"].join("\n")

const sampleTasks: TaskView[] = [
  {
    id: "T-011",
    title: "Propose a cache layer for the price lookups",
    status: "proposed",
    profile: "reasoning",
    analysisMode: "review",
    labels: ["pricing", "performance"],
    dependsOn: [],
    acceptance: [],
    attempts: [],
    decisionNeeded: "Approve the proposal before any agent runs?",
    updatedAt: "2026-11-15T18:10:00Z",
  },
  {
    id: "T-012",
    title: "Write the migration for the attempts table",
    status: "todo",
    ready: true,
    profile: "bounded",
    dependsOn: [{ id: "T-009", title: "Design the schema", status: "done" }],
    acceptance: [{ text: "Migration runs forward and back", result: "unverified" }],
    attempts: [],
    updatedAt: "2026-11-15T17:55:00Z",
  },
  {
    id: "T-013",
    title: "Backfill usage for old attempts, including the ones that ran before the cost columns existed",
    status: "todo",
    ready: false,
    profile: "bounded",
    labels: ["usage"],
    location: { stage: "branch" },
    dependsOn: [{ id: "T-012", title: "Write the migration for the attempts table", status: "todo" }],
    acceptance: [],
    attempts: [],
    updatedAt: "2026-11-15T17:50:00Z",
  },
  {
    id: "T-014",
    title: "Index the docs for search",
    status: "working",
    profile: "bounded",
    analysisMode: "autonomous",
    labels: ["search", "docs"],
    dependsOn: [],
    acceptance: [
      { text: "Every page is indexed", result: "pass", evidence: "1,204 of 1,204" },
      { text: "Search returns in under 200 ms", result: "unverified" },
    ],
    attempts: [
      {
        id: "T-014-A1",
        kind: "implementation",
        status: "failed",
        configured: pi,
        executed: pi,
        contextMode: "fresh",
        startedAt: "2026-11-15T16:00:00Z",
        endedAt: "2026-11-15T16:20:00Z",
        liveness: "finished",
        usage: usage(42_000, 8_000, 0.31),
        checks: [{ name: "tests", result: "fail", note: "3 failing" }],
        blocker: { kind: "quota", summary: "Provider quota exhausted", retryAt: "2026-11-15T21:30:00Z" },
        thread: { id: "th-1", title: "Index docs, first try", href: "t3-thread://th-1" },
      },
      {
        id: "T-014-A2",
        kind: "implementation",
        status: "active",
        configured: pi,
        executed: codex,
        fallbacks: [{ agent: pi, reason: "Quota exhausted" }],
        contextMode: "fork",
        sourceThread: { id: "th-1", title: "Index docs, first try" },
        reason: "Fallback after quota",
        repairOf: "T-014-A1",
        startedAt: "2026-11-15T17:40:00Z",
        liveness: "running",
        lastActivityAt: "2026-11-15T18:40:00Z",
        usage: usage(18_000, 2_500, 0.12),
        thread: { id: "th-2", href: "t3-thread://th-2" },
      },
    ],
    activeAttemptId: "T-014-A2",
    attachments: [
      image("T-014-shot-1", "search-results.png", "Search results page with the docs index", "#3b6fe0", 4),
      image("T-014-shot-2", "index-status.png", "Index status panel at 1,204 pages", "#1f9d6b", 3),
      {
        id: "T-014-log",
        name: "indexer.log",
        kind: "file",
        alt: "Indexer log",
        src: `data:text/plain,${encodeURIComponent(searchLog)}`,
        href: `data:text/plain,${encodeURIComponent(searchLog)}`,
        size: searchLog.length,
        mimeType: "text/plain",
      },
    ],
    location: { stage: "pr", href: "https://example.com/acme/docs/pull/128" },
    usage: usage(60_000, 10_500, 0.43),
    counts: { attempts: 2, repairs: 1, reviews: 0, humanInterventions: 0 },
    links: [
      {
        kind: "pull-request",
        href: "https://example.com/acme/docs/pull/128",
        label: "#128 Index the docs for search",
        state: "open",
      },
      { kind: "branch", href: "https://example.com/acme/docs/tree/index-docs", label: "index-docs" },
      { kind: "issue", href: "https://example.com/acme/docs/issues/97", label: "#97 Search is slow" },
    ],
    updatedAt: "2026-11-15T18:40:00Z",
  },
  {
    id: "T-015",
    title: "Review the agent approval flow",
    status: "review",
    profile: "review",
    dependsOn: [],
    acceptance: [
      { text: "A person approves destructive steps", result: "pass" },
      { text: "Denied steps leave no side effects", result: "fail", evidence: "Toast still shown" },
    ],
    attempts: [
      {
        id: "T-015-A1",
        kind: "review",
        status: "active",
        configured: claude,
        executed: claude,
        contextMode: "reuse",
        sourceThread: { id: "th-7", title: "Approval flow" },
        startedAt: "2026-11-15T17:00:00Z",
        liveness: "suspect_dead",
        lastActivityAt: "2026-11-15T17:55:00Z",
        usage: usage(30_000, 4_000, null),
      },
    ],
    activeAttemptId: "T-015-A1",
    attachments: [image("T-015-shot-1", "approval-dialog.png", "The approval dialog asking a person", "#c2410c", 2)],
    location: { stage: "staging", href: "https://example.com/acme/app/deployments/staging" },
    links: [
      {
        kind: "pull-request",
        href: "https://example.com/acme/app/pull/131",
        label: "#131 Ask before destructive steps",
        state: "merged",
      },
      { kind: "commit", href: "https://example.com/acme/app/commit/4f2a9c1", label: "4f2a9c1" },
    ],
    updatedAt: "2026-11-15T17:55:00Z",
  },
  {
    id: "T-016",
    title: "Deploy the preview environment",
    status: "blocked",
    profile: "lookup",
    dependsOn: [],
    acceptance: [],
    attempts: [
      {
        id: "T-016-A1",
        kind: "integration",
        status: "failed",
        configured: codex,
        startedAt: "2026-11-15T15:00:00Z",
        endedAt: "2026-11-15T15:05:00Z",
        liveness: "finished",
        blocker: { kind: "auth", summary: "Deploy token expired" },
      },
    ],
    decisionNeeded: "Rotate the deploy token?",
    location: { stage: "dev" },
    updatedAt: "2026-11-15T15:05:00Z",
  },
  {
    id: "T-009",
    title: "Design the schema",
    status: "done",
    profile: "reasoning",
    dependsOn: [],
    acceptance: [{ text: "Reviewed by a person", result: "pass" }],
    attempts: [
      {
        id: "T-009-A1",
        kind: "design",
        status: "succeeded",
        configured: claude,
        executed: claude,
        startedAt: "2026-11-15T10:00:00Z",
        endedAt: "2026-11-15T10:45:00Z",
        liveness: "finished",
        usage: usage(25_000, 6_000, 0.58),
        commits: ["3f2a9c1"],
      },
    ],
    acceptedFirstPass: true,
    usage: usage(25_000, 6_000, 0.58),
    location: { stage: "prod" },
    updatedAt: "2026-11-15T10:45:00Z",
  },
]

const statuses: TaskStatus[] = ["proposed", "todo", "working", "review", "blocked", "done", "cancelled"]
const agents = [codex, claude, pi]
const generatedShot = image("G-shot", "screenshot.png", "A generated screenshot", "#3b6fe0", 3)

function generateTasks(count = 200, maxAttempts = 30): TaskView[] {
  return Array.from({ length: count }, (_, index) => {
    const status = statuses[index % statuses.length] ?? "todo"
    const attemptCount = status === "proposed" || status === "todo" ? 0 : (index * 7) % (maxAttempts + 1)
    const attempts: AttemptView[] = Array.from({ length: attemptCount }, (__, n) => {
      const agent = agents[(index + n) % agents.length] ?? codex
      const last = n === attemptCount - 1
      return {
        id: `G-${index}-A${n + 1}`,
        kind: n % 5 === 4 ? "review" : "implementation",
        status: last && status === "working" ? "active" : last && status === "done" ? "succeeded" : "superseded",
        configured: agent,
        executed: n % 4 === 3 ? (agents[(index + n + 1) % agents.length] ?? agent) : agent,
        startedAt: new Date(Date.parse(GENERATED_AT) - (attemptCount - n) * 600_000).toISOString(),
        liveness: last && status === "working" ? "running" : "finished",
        usage: usage(10_000 + n * 1_000, 1_500 + n * 100, n % 6 === 5 ? null : 0.05 + n * 0.01),
      }
    })
    return {
      id: `G-${String(index).padStart(3, "0")}`,
      title: `Generated task ${index} with a title long enough to need two lines in a narrow card`,
      status,
      ready: status === "todo" ? index % 2 === 0 : undefined,
      profile: ["bounded", "reasoning", "lookup", "review"][index % 4],
      dependsOn:
        index > 0 && index % 3 === 0 ? [{ id: `G-${String(index - 1).padStart(3, "0")}`, status: "done" }] : [],
      acceptance: [{ text: "Checks pass", result: index % 3 === 0 ? "pass" : "unverified" }],
      attempts,
      activeAttemptId: status === "working" ? attempts.at(-1)?.id : undefined,
      labels: index % 4 === 0 ? ["generated"] : undefined,
      location: index % 3 === 0 ? undefined : { stage: sampleStages[index % sampleStages.length]?.id ?? "dev" },
      attachments: index % 10 === 0 ? [{ ...generatedShot, id: `G-${index}-shot` }] : undefined,
      updatedAt: GENERATED_AT,
    }
  })
}

export { GENERATED_AT, generateTasks, sampleStages, sampleTasks }
