// Sample data for the task dialog example: a task with a branch, commits and uncommitted work, and one without a
// branch yet.
import type { AttemptView, TaskView, UsageSummary } from "@/lib/agent-task-types"
import type { Commit } from "@/lib/commit-graph"

const NOW = "2026-11-18T21:40:00Z"

type TaskBranch = {
  name: string
  base: string
  ahead: number
  behind: number
  /** The remote branch it tracks; `null` while it exists only locally. */
  upstream: string | null
  pullRequest?: string
}

type PatchTotals = { files: number; additions: number; deletions: number }

/** What a task's branch changed: the diff against its base, its commits and the checkout's uncommitted work. */
type TaskChangeSet = {
  /** The branch against its base, `git diff base...branch`. */
  all: PatchTotals & { patch: string }
  /** Newest first, as `git log base..branch` lists them. */
  commits: Commit[]
  /** Each commit's own diff, by id. */
  patches: Record<string, string>
  /** The upstream's head; commits above it aren't pushed. Commits mark themselves with `unpushed` without one. */
  upstreamHead?: string
  worktree?: { staged: PatchTotals & { patch: string }; unstaged: PatchTotals & { patch: string } }
}

const measured = (value: number) => ({ value, quality: "measured" as const })
const estimated = (value: number) => ({ value, quality: "estimated" as const, source: "list prices, 2026-11" })

function usage(
  input: number,
  output: number,
  cacheRead: number,
  cacheWrite: number,
  reasoning: number,
  cost: number,
  minutes: number,
): UsageSummary {
  return {
    inputTokens: measured(input),
    outputTokens: measured(output),
    cacheReadTokens: measured(cacheRead),
    cacheWriteTokens: measured(cacheWrite),
    reasoningTokens: measured(reasoning),
    costUsd: estimated(cost),
    durationMs: measured(minutes * 60_000),
  }
}

const delays = [5, 10, 20, 40, 80, 160, 320, 640]

function chart(dark: boolean) {
  const background = dark ? "#16181d" : "#f7f7f8"
  const text = dark ? "#e7e8ea" : "#1d1f24"
  const muted = dark ? "#8b8f98" : "#6b6f78"
  const bars = delays
    .map((delay, index) => {
      const height = Math.round((Math.log2(delay) / Math.log2(640)) * 380)
      return `<rect x="${72 + index * 104}" y="${540 - height}" width="64" height="${height}" rx="6" fill="#4f7cff"/><text x="${104 + index * 104}" y="${528 - height}" text-anchor="middle" font-family="sans-serif" font-size="18" fill="${muted}">${delay}</text>`
    })
    .join("")
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="600" viewBox="0 0 960 600"><rect width="960" height="600" fill="${background}"/><text x="48" y="64" font-family="sans-serif" font-size="28" fill="${text}">Retry delay by attempt (s, p95)</text>${bars}</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function meter(used: number, dark: boolean) {
  const background = dark ? "#16181d" : "#f7f7f8"
  const text = dark ? "#e7e8ea" : "#1d1f24"
  const muted = dark ? "#8b8f98" : "#6b6f78"
  const width = Math.round((used / 120) * 832)
  const fill = used > 100 ? "#e5484d" : "#30a46c"
  const seconds = Math.ceil((120 - used) / 2)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="600" viewBox="0 0 960 600"><rect width="960" height="600" fill="${background}"/><text x="64" y="96" font-family="sans-serif" font-size="30" fill="${text}">API usage this minute</text><rect x="64" y="200" width="832" height="28" rx="14" fill="${muted}" opacity="0.25"/><rect x="64" y="200" width="${width}" height="28" rx="14" fill="${fill}"/><text x="64" y="290" font-family="sans-serif" font-size="44" fill="${text}">${used} of 120 requests</text><text x="64" y="340" font-family="sans-serif" font-size="20" fill="${muted}">Refills 2 per second · full again in ${seconds} s</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

const implementer = {
  provider: "codex",
  model: "gpt-5.4-codex",
  label: "Codex",
  effort: { name: "effort", value: "high" },
}
const designer = { provider: "claudeAgent", model: "claude-sonnet-5-5", label: "Sonnet" }

const backoffAttempts: AttemptView[] = [
  {
    id: "T-121-A1",
    kind: "implementation",
    status: "failed",
    configured: implementer,
    startedAt: "2026-11-18T15:05:00Z",
    endedAt: "2026-11-18T17:40:00Z",
    liveness: "finished",
    reason: "Backend change with tests; routed to the implementation profile",
    checks: [
      { name: "pnpm test", result: "fail", note: "dispatch.test.ts: gives up after eight attempts" },
      { name: "pnpm lint", result: "pass" },
    ],
    commits: ["598bd4b", "2372a8e"],
    usage: usage(1_120_000, 38_400, 5_900_000, 260_000, 22_000, 2.05, 155),
  },
  {
    id: "T-121-A2",
    kind: "implementation",
    status: "active",
    repairOf: "T-121-A1",
    configured: implementer,
    contextMode: "reuse",
    startedAt: "2026-11-18T19:05:00Z",
    liveness: "running",
    lastActivityAt: "2026-11-18T21:39:00Z",
    commits: ["28e0e8d"],
    usage: usage(720_000, 22_600, 3_300_000, 150_000, 16_000, 1.37, 154),
  },
]

const meterAttempts: AttemptView[] = [
  {
    id: "T-126-A1",
    kind: "design",
    status: "succeeded",
    configured: designer,
    startedAt: "2026-11-18T13:10:00Z",
    endedAt: "2026-11-18T14:02:00Z",
    liveness: "finished",
    reason: "UI design task: mockups in light and dark",
    checks: [{ name: "mockup validate", result: "pass" }],
    usage: usage(410_000, 19_800, 1_700_000, 90_000, 12_500, 0.88, 52),
  },
  {
    id: "T-126-A2",
    kind: "review",
    status: "active",
    configured: implementer,
    startedAt: "2026-11-18T20:30:00Z",
    liveness: "idle",
    lastActivityAt: "2026-11-18T21:12:00Z",
    usage: usage(96_000, 4_100, 380_000, 0, 3_000, 0.19, 42),
  },
]

const backoffTask: TaskView = {
  id: "T-121",
  title: "Back off webhook retries exponentially",
  goal: "Retry failed webhook deliveries with full-jitter exponential backoff, up to 8 attempts, instead of 3 retries 30 seconds apart. Log each scheduled retry with its delay.",
  project: "Webhooks",
  status: "working",
  profile: "backend",
  analysisMode: "autonomous",
  dependsOn: [{ id: "T-112", title: "Expire API tokens", status: "done" }],
  acceptance: [
    {
      text: "Delays grow with each attempt and stay under an hour",
      result: "pass",
      evidence: "backoff.test.ts: 3 passed; p95 delays in retry-delays.png",
    },
    {
      text: "A delivery gives up after 8 attempts",
      result: "fail",
      evidence: "dispatch.test.ts expected 8 calls, got 3 (A1); A2 is fixing it",
    },
    { text: "Each scheduled retry is logged with its delay", result: "unverified" },
  ],
  attempts: backoffAttempts,
  activeAttemptId: "T-121-A2",
  usage: usage(1_840_000, 61_000, 9_200_000, 410_000, 38_000, 3.42, 309),
  counts: { attempts: 2, repairs: 1, reviews: 0, humanInterventions: 0 },
  labels: ["webhooks", "reliability"],
  links: [],
  attachments: [
    {
      id: "retry-delays",
      name: "retry-delays.png",
      kind: "image",
      src: chart(false),
      srcDark: chart(true),
      alt: "Bar chart of p95 retry delays doubling from 5 to 640 seconds",
      size: 84_210,
      mimeType: "image/png",
    },
    {
      id: "dispatch-log",
      name: "dispatch-test.log",
      kind: "file",
      src: "data:text/plain;charset=utf-8,FAIL%20dispatch.test.ts",
      alt: "Test output of the failing dispatch test",
      size: 12_480,
      mimeType: "text/plain",
    },
  ],
  updatedAt: "2026-11-18T21:39:00Z",
}

const meterTask: TaskView = {
  id: "T-126",
  title: "Design the rate-limit usage meter",
  goal: "Show an account how much of its API token's rate limit it is using right now, on the account page, in light and dark.",
  project: "Webhooks",
  status: "review",
  profile: "design",
  analysisMode: "review",
  dependsOn: [{ id: "T-118", title: "Rate-limit the public API per token", status: "review" }],
  decisionNeeded: "A meter, or a plain counter, for accounts on the free plan?",
  acceptance: [
    {
      text: "The meter reads at a glance in both themes",
      result: "pass",
      evidence: "meter-normal.png, meter-near-limit.png",
    },
    { text: "It says when the bucket is full again", result: "pass", evidence: "“full again in 16 s” under the count" },
    { text: "It fits the account page's narrow column", result: "unverified" },
  ],
  attempts: meterAttempts,
  activeAttemptId: "T-126-A2",
  usage: usage(506_000, 23_900, 2_080_000, 90_000, 15_500, 1.07, 94),
  counts: { attempts: 2, repairs: 0, reviews: 1, humanInterventions: 1 },
  acceptedFirstPass: true,
  labels: ["design", "account-page"],
  links: [{ kind: "external", href: "https://example.com/meter", label: "Meter exploration board" }],
  attachments: [38, 112].map((used) => ({
    id: `meter-${used}`,
    name: used > 100 ? "meter-near-limit.png" : "meter-normal.png",
    kind: "image" as const,
    src: meter(used, false),
    srcDark: meter(used, true),
    alt: `Usage meter at ${used} of 120 requests`,
    size: used > 100 ? 63_020 : 61_340,
    mimeType: "image/png",
  })),
  updatedAt: "2026-11-18T21:12:00Z",
}

const backoffSource = `diff --git a/src/webhooks/backoff.ts b/src/webhooks/backoff.ts
new file mode 100644
index 0000000..a1b2c3d
--- /dev/null
+++ b/src/webhooks/backoff.ts
@@ -0,0 +1,7 @@
+export const MAX_ATTEMPTS = 8
+
+/** Full jitter: a random delay up to base × 2^attempt, capped at an hour. */
+export function nextDelayMs(attempt: number, random = Math.random) {
+  const ceiling = Math.min(60 * 60_000, 5_000 * 2 ** attempt)
+  return Math.round(random() * ceiling)
+}
`

const backoffTest = `diff --git a/src/webhooks/backoff.test.ts b/src/webhooks/backoff.test.ts
new file mode 100644
index 0000000..b2c3d4e
--- /dev/null
+++ b/src/webhooks/backoff.test.ts
@@ -0,0 +1,9 @@
+import { expect, it } from "vitest"
+
+import { nextDelayMs } from "./backoff.ts"
+
+it("grows with the attempt and stays under an hour", () => {
+  expect(nextDelayMs(0, () => 1)).toBe(5_000)
+  expect(nextDelayMs(3, () => 1)).toBe(40_000)
+  expect(nextDelayMs(20, () => 1)).toBe(3_600_000)
+})
`

const dispatch = `diff --git a/src/webhooks/dispatch.ts b/src/webhooks/dispatch.ts
index c3d4e5f..d4e5f6a 100644
--- a/src/webhooks/dispatch.ts
+++ b/src/webhooks/dispatch.ts
@@ -3,5 +3,4 @@
 import { signPayload } from "./signature.ts"
-
-const RETRY_DELAY_MS = 30_000
-const MAX_RETRIES = 3
+import { MAX_ATTEMPTS, nextDelayMs } from "./backoff.ts"
+
 export async function deliver(job: DeliveryJob) {
`

const dispatchTest = `diff --git a/src/webhooks/dispatch.test.ts b/src/webhooks/dispatch.test.ts
index e5f6a7b..f6a7b8c 100644
--- a/src/webhooks/dispatch.test.ts
+++ b/src/webhooks/dispatch.test.ts
@@ -18,4 +18,4 @@ it("gives up after the last attempt", async () => {
   await drain(queue)
-  expect(send).toHaveBeenCalledTimes(4)
-  expect(job.state).toBe("failed after 3 retries")
+  expect(send).toHaveBeenCalledTimes(8)
+  expect(job.state).toBe("failed after 8 attempts")
 })
`

const schema = `diff --git a/src/config/schema.ts b/src/config/schema.ts
index 0a1b2c3..1b2c3d4 100644
--- a/src/config/schema.ts
+++ b/src/config/schema.ts
@@ -12,3 +12,3 @@ export const webhookConfig = z.object({
   timeoutMs: z.number().default(10_000),
-  maxRetries: z.number().default(3),
+  maxAttempts: z.number().default(8),
 })
`

const changelog = `diff --git a/CHANGELOG.md b/CHANGELOG.md
index 2c3d4e5..3d4e5f6 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -2,2 +2,3 @@
 ## Unreleased
+- Webhook deliveries back off exponentially, up to 8 attempts.

`

const staged = `diff --git a/src/webhooks/dispatch.ts b/src/webhooks/dispatch.ts
index d4e5f6a..e5f6a7b 100644
--- a/src/webhooks/dispatch.ts
+++ b/src/webhooks/dispatch.ts
@@ -42,3 +42,7 @@ async function deliver(job: DeliveryJob) {
   if (response.ok) return markDelivered(job)
-  if (job.attempt + 1 < MAX_ATTEMPTS) return queue.retry(job, nextDelayMs(job.attempt))
+  if (job.attempt + 1 < MAX_ATTEMPTS) {
+    const delay = nextDelayMs(job.attempt)
+    logger.info({ endpoint: job.endpointId, attempt: job.attempt + 1, delay }, "webhook retry scheduled")
+    return queue.retry(job, delay)
+  }
   return markFailed(job, response.status)
`

const unstaged = `diff --git a/docs/api/webhooks.md b/docs/api/webhooks.md
index f6a7b8c..a7b8c9d 100644
--- a/docs/api/webhooks.md
+++ b/docs/api/webhooks.md
@@ -28,2 +28,3 @@
 ## Retries
-A failed delivery is retried 3 times, 30 seconds apart.
+A failed delivery is retried up to 8 times. Each wait is random, up to 5 seconds × 2 to the
+attempt number, and never more than an hour.
`

function totals(patch: string): PatchTotals {
  let files = 0
  let additions = 0
  let deletions = 0
  for (const line of patch.split("\n")) {
    if (line.startsWith("diff --git ")) files += 1
    else if (line.startsWith("+") && !line.startsWith("+++")) additions += 1
    else if (line.startsWith("-") && !line.startsWith("---")) deletions += 1
  }
  return { files, additions, deletions }
}

const withTotals = (patch: string) => ({ ...totals(patch), patch })

const branch: TaskBranch = { name: "fix/webhook-backoff", base: "main", ahead: 3, behind: 1, upstream: null }

const author = { name: "Codex" }
// The branch's first commit sits on this commit of main.
const forkPoint = "4c1d9e07a3b5f2e8d6c4a1b9e7f5d3c2a0b8e6f4"

const branchCommits: { commit: Omit<Commit, "parents" | "stats" | "unpushed">; patches: string[] }[] = [
  {
    commit: {
      id: "28e0e8d1c4f7a9b2e5d8c1f4a7b0e3d6c9f2a5b8",
      message: "Cap webhook retries at 8 attempts",
      date: "2026-11-18T18:40:00Z",
      author,
    },
    patches: [schema, changelog],
  },
  {
    commit: {
      id: "2372a8e9b0c3d6f9a2e5b8c1d4f7a0e3b6c9d2f5",
      message: "Back off webhook retries exponentially with jitter",
      date: "2026-11-18T16:40:00Z",
      author,
    },
    patches: [backoffTest, dispatchTest],
  },
  {
    commit: {
      id: "598bd4b7e2a5c8f1d4b7e0a3c6f9d2b5e8a1c4f7",
      message: "Extract `src/webhooks/backoff.ts` from the dispatcher",
      date: "2026-11-18T13:40:00Z",
      author,
    },
    patches: [backoffSource, dispatch],
  },
]

const backoffChanges: TaskChangeSet = {
  all: withTotals([backoffSource, backoffTest, dispatch, dispatchTest, schema, changelog].join("")),
  commits: branchCommits.map(({ commit, patches }, index) => ({
    ...commit,
    parents: [branchCommits[index + 1]?.commit.id ?? forkPoint],
    stats: totals(patches.join("")),
    unpushed: branch.upstream === null,
  })),
  patches: Object.fromEntries(branchCommits.map(({ commit, patches }) => [commit.id, patches.join("")])),
  worktree: { staged: withTotals(staged), unstaged: withTotals(unstaged) },
}

const taskDialogTasks: TaskView[] = [backoffTask, meterTask]

const taskBranches: Record<string, TaskBranch> = { "T-121": branch }

const taskChanges: Record<string, TaskChangeSet> = { "T-121": backoffChanges }

export { NOW as TASK_DIALOG_NOW, taskBranches, taskChanges, taskDialogTasks }
export type { PatchTotals, TaskBranch, TaskChangeSet }
