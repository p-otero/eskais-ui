// oxlint-disable max-lines -- fixture data: generated histories and the patches the git views show
import type { Commit } from "@/lib/commit-graph"

type GitTreeFile = { path: string; status?: "added" | "modified" | "deleted" | "renamed"; from?: string }

export const NOW = "2026-11-18T21:40:00Z"

export type Repo = {
  id: string
  name: string
  /** Relative to the workspace folder. */
  path: string
  branch: string
  dirty: number
  /** Commits on the current branch not on its upstream; `null` without an upstream. */
  ahead: number | null
  behind: number | null
  /** `null` for a repository with no remote at all. */
  remote: string | null
  commits: number
}

export const WORKSPACE = "~/work/acme"

export const repos: Repo[] = [
  {
    id: "api",
    name: "api",
    path: "api",
    branch: "main",
    dirty: 0,
    ahead: 0,
    behind: 0,
    remote: "origin",
    commits: 1284,
  },
  {
    id: "app",
    name: "app",
    path: "app",
    branch: "feat/onboarding-steps",
    dirty: 5,
    ahead: 2,
    behind: 7,
    remote: "origin",
    commits: 2310,
  },
  {
    id: "docs",
    name: "docs",
    path: "docs",
    branch: "main",
    dirty: 1,
    ahead: null,
    behind: null,
    remote: null,
    commits: 146,
  },
  {
    id: "cli",
    name: "acme-cli",
    path: "tools/acme-cli",
    branch: "release/0.9",
    dirty: 0,
    ahead: 3,
    behind: 0,
    remote: "origin",
    commits: 412,
  },
]

export type BranchRef = { name: string; ahead: number; behind: number; pushed: boolean }

export const apiBranches: BranchRef[] = [
  { name: "main", ahead: 0, behind: 0, pushed: true },
  { name: "feat/rate-limit-tokens", ahead: 4, behind: 6, pushed: true },
  { name: "fix/webhook-backoff", ahead: 3, behind: 1, pushed: false },
  { name: "release/2.4", ahead: 2, behind: 31, pushed: true },
  { name: "chore/bump-effect", ahead: 1, behind: 12, pushed: true },
]

export const authors = [
  { name: "Mara Lindqvist", email: "mara@acme.example" },
  { name: "Tomás Ferreyra", email: "tomas@acme.example" },
  { name: "Aiko Brandt", email: "aiko@acme.example" },
  { name: "Jun Okafor", email: "jun@acme.example" },
  { name: "Priya Halvorsen", email: "priya@acme.example" },
]

const subjects = [
  "Validate `src/webhooks/payload.ts` against the shared schema",
  "Paginate invoice listings by cursor",
  "Drop the unused `src/legacy/csv-export.ts`",
  "Log the request id on every 5xx",
  "Cache tenant settings for 30 seconds",
  "Return 409 when a slug is taken",
  "Retry Postgres serialization failures once",
  "Split `src/routes/admin.ts` by resource",
  "Fix the timezone of daily usage rollups",
  "Stream large exports instead of buffering",
  "Rename `customerId` to `accountId` in the events table",
  "Add an index on events (account_id, created_at)",
  "Reject expired API tokens before the database lookup",
  "Count webhook deliveries per endpoint",
  "Move health checks to `src/http/health.ts`",
  "Keep the audit log when an account is deleted",
  "Trim whitespace from imported contact emails",
  "Bump effect to 3.21",
  "Handle empty bodies on PATCH",
  "Document the error codes in `docs/errors.md`",
  "Make migrations idempotent on retry",
  "Send the retry-after header with 503s",
  "Close idle database connections after 5 minutes",
  "Guard the billing job against overlapping runs",
  "Fix a flaky test in `src/jobs/scheduler.test.ts`",
  "Parse ISO durations in the config",
  "Mask secrets in the startup log",
  "Use the account locale in invoice emails",
  "Read the S3 bucket from the environment",
  "Skip soft-deleted projects in search",
  "Return the account plan from `/v1/me`",
  "Sign webhook payloads with the endpoint secret",
  "Fail fast when DATABASE_URL is missing",
  "Add a smoke test for the invoice PDF route",
  "Fix the off-by-one in event pagination",
  "Store invoice totals in minor units",
  "Run migrations before the server starts",
  "Explain token scopes in `docs/api/authentication.md`",
  "Drop the deprecated `/v0` routes",
  "Lower the default pool size to 10",
  "Expose job durations as a histogram",
  "Accept lowercase currency codes",
  "Retry S3 uploads on 503",
  "Normalize phone numbers on import",
  "Make the rollup job resumable",
  "Reject webhook URLs that resolve to private addresses",
  "Return 422 with field errors on invalid bodies",
  "Keep request logs for 14 days",
  "Add `scripts/seed.ts` for local data",
  "Wrap account deletion in one transaction",
]

const branchTopics = [
  "feat/invoice-cursor",
  "fix/rollup-timezone",
  "feat/export-streaming",
  "chore/split-admin-routes",
  "feat/audit-retention",
  "fix/token-expiry",
  "feat/webhook-metrics",
  "chore/config-durations",
]

export function lcg(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 2 ** 32
  }
}

export function hashOf(random: () => number): string {
  let hex = ""
  for (let index = 0; index < 40; index += 1) hex += Math.floor(random() * 16).toString(16)
  return hex
}

export const HOUR = 3_600_000

type Generated = { commits: Commit[]; mainline: Commit[] }

export type HistoryPool = { subjects: readonly string[]; topics: readonly string[]; tags: readonly [number, string][] }

const apiPool: HistoryPool = {
  subjects,
  topics: branchTopics,
  tags: [
    [3, "v2.5.0-rc.1"],
    [58, "v2.4.0"],
    [190, "v2.3.0"],
  ],
}

export function generateHistory(size: number, seed: number, start: number, pool: HistoryPool = apiPool): Generated {
  const random = lcg(seed)
  let last: unknown
  const pick = <T>(list: readonly T[]): T => {
    let next = list[Math.floor(random() * list.length)] as T
    while (next === last && list.length > 1) next = list[Math.floor(random() * list.length)] as T
    last = next
    return next
  }
  const oldestFirst: Commit[][] = []
  let time = start - size * 5 * HOUR
  let parent: string | null = hashOf(random)
  let rows = 0
  let pr = 140
  const mainline: Commit[] = []
  while (rows < size) {
    time += (2 + random() * 6) * HOUR
    const merge = mainline.length > 4 && random() < 0.16 && parent !== null
    if (!merge) {
      const id = hashOf(random)
      const commit: Commit = {
        id,
        parents: parent === null ? [] : [parent],
        message: pick(pool.subjects),
        date: new Date(time).toISOString(),
        author: pick(authors),
        stats: {
          files: 1 + Math.floor(random() * 6),
          additions: Math.floor(random() * 140),
          deletions: Math.floor(random() * 60),
        },
      }
      oldestFirst.push([commit])
      mainline.push(commit)
      parent = id
      rows += 1
      continue
    }
    const topic = pick(pool.topics)
    const length = 2 + Math.floor(random() * 4)
    const branch: Commit[] = []
    let branchParent: string = parent as string
    for (let index = 0; index < length; index += 1) {
      time += (0.5 + random() * 3) * HOUR
      const id = hashOf(random)
      branch.push({
        id,
        parents: [branchParent],
        message: pick(pool.subjects),
        date: new Date(time).toISOString(),
        author: pick(authors),
        stats: {
          files: 1 + Math.floor(random() * 4),
          additions: Math.floor(random() * 90),
          deletions: Math.floor(random() * 30),
        },
      })
      branchParent = id
    }
    time += HOUR
    pr += 1 + Math.floor(random() * 3)
    const id = hashOf(random)
    const mergeCommit: Commit = {
      id,
      parents: [parent as string, branchParent],
      message: `Merge pull request #${pr} from acme/${topic}`,
      date: new Date(time).toISOString(),
      author: pick(authors),
    }
    oldestFirst.push([mergeCommit, ...branch.toReversed()])
    mainline.push(mergeCommit)
    parent = id
    rows += 1 + length
  }
  const shift = start - time
  const commits = oldestFirst
    .toReversed()
    .flat()
    .map((commit) => ({ ...commit, date: new Date(Date.parse(String(commit.date)) + shift).toISOString() }))
  const tagged = new Map<number, { label: string; tone: "info" | "success" }>(
    pool.tags.map(([index, label], order) => [index, { label, tone: order === 0 ? "info" : "success" }]),
  )
  return {
    commits: commits.map((commit, index) => {
      const tag = tagged.get(index)
      return tag === undefined ? commit : { ...commit, tags: [tag] }
    }),
    mainline: mainline.toReversed(),
  }
}

const history = generateHistory(320, 7, Date.parse(NOW) - 6 * HOUR)

export const RATE_LIMIT_COMMIT: Commit = {
  id: "9be07d2c41f05a8e3d6b2a7c90e14f5b8d3c6a21",
  parents: ["4f1a9c3e2b7d6a5f8e0c1b2a3d4e5f6a7b8c9d0e"],
  message: "Add token-bucket rate limiting to the public API",
  body: "Each API token gets a bucket of 120 requests that refills at 2 per second. Buckets live in Redis\nwhen REDIS_URL is set and in memory otherwise. Over the limit, the API answers 429 with\nretry-after and x-ratelimit-* headers. Replaces the fixed-window throttle in src/legacy.",
  date: "2026-11-18T16:12:00Z",
  author: authors[0],
  stats: { files: 20, additions: 165, deletions: 39 },
  tags: [{ label: "API-118", tone: "violet" }],
}

export const mainCommits: Commit[] = [
  { ...RATE_LIMIT_COMMIT, parents: [history.commits[0]?.id ?? ""] },
  ...history.commits,
]

const branchHeads: Record<string, { messages: string[]; fork: number; seed: number }> = {
  "feat/rate-limit-tokens": {
    fork: 6,
    seed: 11,
    messages: [
      "Send x-ratelimit-* headers from `src/http/middleware/rate-limit.ts`",
      "Store buckets in Redis when REDIS_URL is set",
      "Answer 429 with retry-after over the limit",
      "Add a token bucket in `src/rate-limit/token-bucket.ts`",
    ],
  },
  "fix/webhook-backoff": {
    fork: 1,
    seed: 23,
    messages: [
      "Cap webhook retries at 8 attempts",
      "Back off webhook retries exponentially with jitter",
      "Extract `src/webhooks/backoff.ts` from the dispatcher",
    ],
  },
  "release/2.4": {
    fork: 58,
    seed: 31,
    messages: ["Backport the token expiry check", "Fix the rollup timezone on 2.4"],
  },
  "chore/bump-effect": { fork: 12, seed: 41, messages: ["Bump effect to 3.22"] },
}

type OwnBranch = { name: string; commits: Commit[]; base: Commit[] }

const branchAuthors: Record<string, number> = {
  "feat/rate-limit-tokens": 0,
  "fix/webhook-backoff": 3,
  "release/2.4": 1,
  "chore/bump-effect": 4,
}

const ownBranches = new Map<string, OwnBranch>(
  Object.entries(branchHeads).map(([name, head]) => {
    const random = lcg(head.seed)
    const forkAt = mainCommits.findIndex((commit) => commit.id === history.mainline[head.fork]?.id)
    const base = mainCommits.slice(Math.max(forkAt, 0))
    let parent = base[0]?.id ?? ""
    let time = Date.parse(NOW) - head.messages.length * 3 * HOUR
    const own: Commit[] = head.messages.toReversed().map((message) => {
      time += (1 + random() * 2) * HOUR
      const commit: Commit = {
        id: hashOf(random),
        parents: [parent],
        message,
        date: new Date(time).toISOString(),
        author: authors[branchAuthors[name] ?? 0],
        stats: {
          files: 2 + Math.floor(random() * 6),
          additions: Math.floor(random() * 160),
          deletions: Math.floor(random() * 40),
        },
      }
      parent = commit.id
      return commit
    })
    return [name, { name, commits: own.toReversed(), base }]
  }),
)

export function commitsFor(branch: string): Commit[] {
  const own = ownBranches.get(branch)
  return own === undefined ? mainCommits : [...own.commits, ...own.base]
}

export function ownCommitsOf(branch: string): Commit[] {
  return ownBranches.get(branch)?.commits ?? []
}

export const allCommits: Commit[] = [...[...ownBranches.values()].flatMap((branch) => branch.commits), ...mainCommits]

export const branchHeadsList = apiBranches.map((branch) => {
  const own = ownBranches.get(branch.name)
  const head = own?.commits[0] ?? mainCommits[0]
  return {
    name: branch.name,
    head: head?.id ?? "",
    ahead: branch.ahead,
    behind: branch.behind,
    updatedAt: head?.date,
    author: head?.author,
  }
})

export function olderCommits(after: Commit[], count: number): Commit[] {
  const last = after.at(-1)
  const random = lcg(after.length)
  let parent = last?.parents[0] ?? hashOf(random)
  let time = Date.parse(String(last?.date ?? NOW))
  const page: Commit[] = []
  for (let index = 0; index < count; index += 1) {
    time -= (2 + random() * 6) * HOUR
    const next = hashOf(random)
    page.push({
      id: parent,
      parents: [next],
      message: subjects[Math.floor(random() * subjects.length)] as string,
      date: new Date(time).toISOString(),
      author: authors[Math.floor(random() * authors.length)],
    })
    parent = next
  }
  return page
}

type Line = string

export type PatchFile = {
  path: string
  status: "added" | "modified" | "deleted" | "renamed"
  from?: string
  similarity?: number
  hunks: { oldStart: number; newStart: number; context?: string; lines: Line[] }[]
}

function shortHash(seed: string): string {
  let value = 0
  for (const char of seed) value = (Math.imul(value, 31) + char.charCodeAt(0)) >>> 0
  return value.toString(16).padStart(7, "0").slice(0, 7)
}

export function renderPatch(files: PatchFile[]): string {
  const out: string[] = []
  for (const file of files) {
    const before = file.from ?? file.path
    out.push(`diff --git a/${before} b/${file.path}`)
    if (file.status === "added") out.push("new file mode 100644", `index 0000000..${shortHash(file.path)}`)
    else if (file.status === "deleted") out.push("deleted file mode 100644", `index ${shortHash(file.path)}..0000000`)
    else if (file.status === "renamed") {
      out.push(`similarity index ${file.similarity ?? 90}%`, `rename from ${before}`, `rename to ${file.path}`)
      out.push(`index ${shortHash(before)}..${shortHash(file.path)} 100644`)
    } else out.push(`index ${shortHash(before)}..${shortHash(`${file.path}!`)} 100644`)
    out.push(file.status === "added" ? "--- /dev/null" : `--- a/${before}`)
    out.push(file.status === "deleted" ? "+++ /dev/null" : `+++ b/${file.path}`)
    for (const hunk of file.hunks) {
      const oldCount = hunk.lines.filter((line) => !line.startsWith("+")).length
      const newCount = hunk.lines.filter((line) => !line.startsWith("-")).length
      const oldStart = oldCount === 0 ? 0 : hunk.oldStart
      const newStart = newCount === 0 ? 0 : hunk.newStart
      out.push(`@@ -${oldStart},${oldCount} +${newStart},${newCount} @@${hunk.context ? ` ${hunk.context}` : ""}`)
      out.push(...hunk.lines)
    }
  }
  return `${out.join("\n")}\n`
}

export const IM = "import"

export const add = (text: string): Line[] => text.split("\n").map((line) => `+${line}`)
export const del = (text: string): Line[] => text.split("\n").map((line) => `-${line}`)
export const ctx = (text: string): Line[] => text.split("\n").map((line) => ` ${line}`)

const rateLimitFiles: PatchFile[] = [
  {
    path: "src/rate-limit/token-bucket.ts",
    status: "added",
    hunks: [
      {
        oldStart: 0,
        newStart: 1,
        lines: add(`${IM} type { BucketStore } from "./store.ts"

export type BucketPolicy = {
  /** Requests a full bucket allows in a burst. */
  capacity: number
  /** Tokens added back per second. */
  refillPerSecond: number
}

export type Decision =
  | { allowed: true; remaining: number; resetAt: number }
  | { allowed: false; remaining: 0; retryAfterMs: number; resetAt: number }

export function createTokenBucket(store: BucketStore, policy: BucketPolicy) {
  const refillMs = 1000 / policy.refillPerSecond

  async function take(key: string, now = Date.now()): Promise<Decision> {
    const state = (await store.read(key)) ?? { tokens: policy.capacity, updatedAt: now }
    const refilled = Math.min(
      policy.capacity,
      state.tokens + Math.floor((now - state.updatedAt) / refillMs),
    )
    const resetAt = now + (policy.capacity - refilled) * refillMs
    if (refilled < 1) {
      const retryAfterMs = Math.ceil(refillMs - ((now - state.updatedAt) % refillMs))
      return { allowed: false, remaining: 0, retryAfterMs, resetAt }
    }
    await store.write(key, { tokens: refilled - 1, updatedAt: now }, resetAt - now)
    return { allowed: true, remaining: refilled - 1, resetAt }
  }

  return { take, policy }
}`),
      },
    ],
  },
  {
    path: "src/rate-limit/token-bucket.test.ts",
    status: "added",
    hunks: [
      {
        oldStart: 0,
        newStart: 1,
        lines: add(`${IM} { describe, expect, it } from "vitest"

${IM} { createMemoryStore } from "./store.ts"
${IM} { createTokenBucket } from "./token-bucket.ts"

describe("token bucket", () => {
  const policy = { capacity: 3, refillPerSecond: 1 }

  it("allows a burst up to the capacity", async () => {
    const bucket = createTokenBucket(createMemoryStore(), policy)
    const results = await Promise.all([1, 2, 3, 4].map(() => bucket.take("tok_a", 0)))
    expect(results.map((result) => result.allowed)).toEqual([true, true, true, false])
  })

  it("refills one token per second", async () => {
    const bucket = createTokenBucket(createMemoryStore(), policy)
    for (let index = 0; index < 3; index += 1) await bucket.take("tok_a", 0)
    expect((await bucket.take("tok_a", 999)).allowed).toBe(false)
    expect((await bucket.take("tok_a", 1000)).allowed).toBe(true)
  })

  it("keeps tokens apart", async () => {
    const bucket = createTokenBucket(createMemoryStore(), policy)
    for (let index = 0; index < 3; index += 1) await bucket.take("tok_a", 0)
    expect((await bucket.take("tok_b", 0)).remaining).toBe(2)
  })
})`),
      },
    ],
  },
  {
    path: "src/rate-limit/store.ts",
    status: "added",
    hunks: [
      {
        oldStart: 0,
        newStart: 1,
        lines: add(`export type BucketState = { tokens: number; updatedAt: number }

export interface BucketStore {
  read(key: string): Promise<BucketState | undefined>
  write(key: string, state: BucketState, ttlMs: number): Promise<void>
}

export function createMemoryStore(): BucketStore {
  const buckets = new Map<string, BucketState>()
  return {
    read: async (key) => buckets.get(key),
    write: async (key, state) => {
      buckets.set(key, state)
    },
  }
}`),
      },
    ],
  },
  {
    path: "src/rate-limit/redis-store.ts",
    status: "added",
    hunks: [
      {
        oldStart: 0,
        newStart: 1,
        lines: add(`${IM} type { Redis } from "ioredis"

${IM} type { BucketState, BucketStore } from "./store.ts"

export function createRedisStore(redis: Redis, prefix = "rl:"): BucketStore {
  return {
    async read(key) {
      const raw = await redis.get(prefix + key)
      return raw === null ? undefined : (JSON.parse(raw) as BucketState)
    },
    async write(key, state, ttlMs) {
      await redis.set(prefix + key, JSON.stringify(state), "PX", Math.max(ttlMs, 1000))
    },
  }
}`),
      },
    ],
  },
  {
    path: "src/rate-limit/index.ts",
    status: "added",
    hunks: [
      {
        oldStart: 0,
        newStart: 1,
        lines: add(`export { createRedisStore } from "./redis-store.ts"
export { createMemoryStore, type BucketStore } from "./store.ts"
export { createTokenBucket, type BucketPolicy, type Decision } from "./token-bucket.ts"`),
      },
    ],
  },
  {
    path: "src/http/middleware/rate-limit.ts",
    status: "added",
    hunks: [
      {
        oldStart: 0,
        newStart: 1,
        lines: add(`${IM} type { MiddlewareHandler } from "hono"

${IM} { tooManyRequests } from "../errors.ts"
${IM} { counters } from "../../metrics/counters.ts"
${IM} type { createTokenBucket } from "../../rate-limit/index.ts"

type Bucket = ReturnType<typeof createTokenBucket>

export function rateLimit(bucket: Bucket): MiddlewareHandler {
  return async (context, next) => {
    const token = context.get("apiToken")
    if (token === undefined) return next()
    const decision = await bucket.take(token.id)
    context.header("x-ratelimit-limit", String(bucket.policy.capacity))
    context.header("x-ratelimit-remaining", String(decision.remaining))
    context.header("x-ratelimit-reset", String(Math.ceil(decision.resetAt / 1000)))
    if (!decision.allowed) {
      counters.rateLimited.inc({ route: context.req.routePath })
      context.header("retry-after", String(Math.ceil(decision.retryAfterMs / 1000)))
      return tooManyRequests(context)
    }
    return next()
  }
}`),
      },
    ],
  },
  {
    path: "src/http/middleware/index.ts",
    status: "modified",
    hunks: [
      {
        oldStart: 1,
        newStart: 1,
        lines: [
          ...ctx(`export { cors } from "./cors.ts"
export { requestId } from "./request-id.ts"`),
          ...add(`export { rateLimit } from "./rate-limit.ts"`),
          ...ctx(`export { timing } from "./timing.ts"`),
          ...del(`export { throttle } from "../../legacy/throttle.ts"`),
        ],
      },
    ],
  },
  {
    path: "src/http/server.ts",
    status: "modified",
    hunks: [
      {
        oldStart: 4,
        newStart: 4,
        lines: [
          ...ctx(`${IM} { loadConfig } from "../config/index.ts"
${IM} { apiTokens } from "../auth/api-tokens.ts"`),
          ...del(`${IM} { cors, requestId, throttle, timing } from "./middleware/index.ts"`),
          ...add(`${IM} { createMemoryStore, createRedisStore, createTokenBucket } from "../rate-limit/index.ts"
${IM} { cors, rateLimit, requestId, timing } from "./middleware/index.ts"`),
          ...ctx(`${IM} { publicRoutes } from "../routes/public/index.ts"`),
        ],
      },
      {
        oldStart: 21,
        newStart: 22,
        context: "export function createServer(deps: ServerDeps) {",
        lines: [
          ...ctx(`  const config = loadConfig()
  const app = new Hono()
`),
          ...del(`  app.use("/v1/*", throttle({ windowMs: 60_000, max: config.throttle.max }))`),
          ...add(`  const store = deps.redis ? createRedisStore(deps.redis) : createMemoryStore()
  const bucket = createTokenBucket(store, config.rateLimit)
`),
          ...ctx(`  app.use("*", requestId(), timing(), cors(config.cors))
  app.use("/v1/*", apiTokens(deps.db))`),
          ...add(`  app.use("/v1/*", rateLimit(bucket))`),
          ...ctx(`  app.route("/v1", publicRoutes(deps))`),
        ],
      },
    ],
  },
  {
    path: "src/http/errors.ts",
    status: "modified",
    hunks: [
      {
        oldStart: 30,
        newStart: 30,
        lines: [
          ...ctx(`export const notFound = (context: Context) =>
  context.json({ error: { code: "not_found", message: "Not found" } }, 404)
`),
          ...add(`export const tooManyRequests = (context: Context) =>
  context.json(
    { error: { code: "rate_limited", message: "Too many requests for this API token" } },
    429,
  )
`),
          ...ctx(`export const internalError = (context: Context, requestId: string) =>`),
        ],
      },
    ],
  },
  {
    path: "src/config/schema.ts",
    status: "modified",
    hunks: [
      {
        oldStart: 18,
        newStart: 18,
        lines: [
          ...ctx(`  cors: Schema.Struct({ origins: Schema.Array(Schema.String) }),`),
          ...del(`  throttle: Schema.Struct({ max: Schema.Number }),`),
          ...add(`  rateLimit: Schema.Struct({
    capacity: Schema.Number.pipe(Schema.int(), Schema.positive()),
    refillPerSecond: Schema.Number.pipe(Schema.positive()),
  }),
  redisUrl: Schema.optional(Schema.String),`),
          ...ctx(`  database: Schema.Struct({ url: Schema.String, poolSize: Schema.Number }),`),
        ],
      },
    ],
  },
  {
    path: "src/config/defaults.ts",
    status: "modified",
    hunks: [
      {
        oldStart: 9,
        newStart: 9,
        lines: [
          ...ctx(`  cors: { origins: ["https://app.acme.example"] },`),
          ...del(`  throttle: { max: 600 },`),
          ...add(`  rateLimit: { capacity: 120, refillPerSecond: 2 },`),
          ...ctx(`  database: { url: "postgres://localhost/acme", poolSize: 10 },`),
        ],
      },
    ],
  },
  {
    path: "src/auth/api-tokens.ts",
    status: "modified",
    hunks: [
      {
        oldStart: 40,
        newStart: 40,
        context: "export function apiTokens(db: Database): MiddlewareHandler {",
        lines: [
          ...ctx(`    const token = await db.apiTokens.findByHash(hash(raw))
    if (token === undefined || token.revokedAt !== null) return unauthorized(context)`),
          ...add(`    if (token.expiresAt !== null && token.expiresAt < new Date()) return unauthorized(context)`),
          ...del(`    context.set("tokenId", token.id)`),
          ...add(`    context.set("apiToken", { id: token.id, accountId: token.accountId })`),
          ...ctx(`    await next()`),
        ],
      },
    ],
  },
  {
    path: "src/auth/api-tokens.test.ts",
    status: "modified",
    hunks: [
      {
        oldStart: 52,
        newStart: 52,
        lines: [
          ...ctx(`  it("rejects a revoked token", async () => {
    const response = await request("/v1/me", { token: revoked })
    expect(response.status).toBe(401)
  })
`),
          ...add(`  it("rejects an expired token", async () => {
    const response = await request("/v1/me", { token: expired })
    expect(response.status).toBe(401)
  })
`),
          ...ctx(`  it("sets the token on the context", async () => {`),
          ...del(`    expect(seen.tokenId).toBe(valid.id)`),
          ...add(`    expect(seen.apiToken).toEqual({ id: valid.id, accountId: valid.accountId })`),
        ],
      },
    ],
  },
  {
    path: "src/routes/public/index.ts",
    status: "modified",
    hunks: [
      {
        oldStart: 14,
        newStart: 14,
        lines: [
          ...ctx(`  const routes = new Hono()`),
          ...del(`  routes.get("/me", (context) => context.json({ tokenId: context.get("tokenId") }))`),
          ...add(`  routes.get("/me", (context) => context.json({ token: context.get("apiToken") }))`),
          ...ctx(`  routes.route("/invoices", invoices(deps))`),
        ],
      },
    ],
  },
  {
    path: "src/metrics/counters.ts",
    status: "modified",
    hunks: [
      {
        oldStart: 22,
        newStart: 22,
        lines: [
          ...ctx(
            `  webhookDeliveries: new Counter({ name: "webhook_deliveries_total", labelNames: ["endpoint", "status"] }),`,
          ),
          ...del(`  throttled: new Counter({ name: "throttled_requests_total", labelNames: ["route"] }),`),
          ...add(`  rateLimited: new Counter({ name: "rate_limited_requests_total", labelNames: ["route"] }),`),
          ...ctx(`}`),
        ],
      },
    ],
  },
  {
    path: "src/legacy/throttle.ts",
    status: "deleted",
    hunks: [
      {
        oldStart: 1,
        newStart: 0,
        lines: del(`${IM} type { MiddlewareHandler } from "hono"

type ThrottleOptions = { windowMs: number; max: number }

const windows = new Map<string, { count: number; startedAt: number }>()

export function throttle({ windowMs, max }: ThrottleOptions): MiddlewareHandler {
  return async (context, next) => {
    const key = context.req.header("authorization") ?? context.req.header("x-forwarded-for") ?? "anon"
    const now = Date.now()
    const current = windows.get(key)
    if (current === undefined || now - current.startedAt > windowMs) {
      windows.set(key, { count: 1, startedAt: now })
      return next()
    }
    current.count += 1
    if (current.count > max) return context.text("Too many requests", 429)
    return next()
  }
}`),
      },
    ],
  },
  {
    path: "src/legacy/throttle.test.ts",
    status: "deleted",
    hunks: [
      {
        oldStart: 1,
        newStart: 0,
        lines: del(`${IM} { expect, it } from "vitest"

${IM} { throttle } from "./throttle.ts"

it("blocks past the window's maximum", async () => {
  const handler = throttle({ windowMs: 1000, max: 1 })
  expect(await run(handler)).toBe(200)
  expect(await run(handler)).toBe(429)
})`),
      },
    ],
  },
  {
    path: "docs/api/rate-limits.md",
    from: "docs/rate-limits.md",
    status: "renamed",
    similarity: 64,
    hunks: [
      {
        oldStart: 1,
        newStart: 1,
        lines: [
          ...ctx(`# Rate limits
`),
          ...del(`Each client may send 600 requests per minute. Past that, the API answers 429 until the minute ends.`),
          ...add(`Each API token has a bucket of 120 requests that refills at 2 requests per second, so a client can
burst and then keep a steady 120 requests per minute.

Every response carries:

| Header | Meaning |
| --- | --- |
| \`x-ratelimit-limit\` | The bucket's size |
| \`x-ratelimit-remaining\` | Requests left right now |
| \`x-ratelimit-reset\` | When the bucket is full again, in Unix seconds |

Past the limit the API answers \`429 rate_limited\` with \`retry-after\` in seconds.`),
        ],
      },
    ],
  },
  {
    path: "package.json",
    status: "modified",
    hunks: [
      {
        oldStart: 18,
        newStart: 18,
        lines: [...ctx(`    "hono": "4.9.2",`), ...add(`    "ioredis": "5.6.1",`), ...ctx(`    "pg": "8.16.3",`)],
      },
    ],
  },
  {
    path: "CHANGELOG.md",
    status: "modified",
    hunks: [
      {
        oldStart: 1,
        newStart: 1,
        lines: [
          ...ctx(`# Changelog
`),
          ...add(`## Unreleased

- Rate limits are per API token: a bucket of 120 requests refilled at 2 per second, with
  \`x-ratelimit-*\` headers on every response. The fixed 600-per-minute throttle is gone.
`),
          ...ctx(`## 2.4.0`),
        ],
      },
    ],
  },
]

export const rateLimitPatch = renderPatch(rateLimitFiles)

export const webhookFiles: PatchFile[] = [
  {
    path: "src/webhooks/backoff.ts",
    status: "added",
    hunks: [
      {
        oldStart: 0,
        newStart: 1,
        lines: add(`export const MAX_ATTEMPTS = 8

/** Full jitter: a random delay up to base × 2^attempt, capped at an hour. */
export function nextDelayMs(attempt: number, random = Math.random): number {
  const ceiling = Math.min(60 * 60_000, 5_000 * 2 ** attempt)
  return Math.round(random() * ceiling)
}`),
      },
    ],
  },
  {
    path: "src/webhooks/backoff.test.ts",
    status: "added",
    hunks: [
      {
        oldStart: 0,
        newStart: 1,
        lines: add(`${IM} { expect, it } from "vitest"

${IM} { nextDelayMs } from "./backoff.ts"

it("grows with the attempt and stays under an hour", () => {
  expect(nextDelayMs(0, () => 1)).toBe(5_000)
  expect(nextDelayMs(3, () => 1)).toBe(40_000)
  expect(nextDelayMs(20, () => 1)).toBe(3_600_000)
})`),
      },
    ],
  },
  {
    path: "src/webhooks/dispatch.ts",
    status: "modified",
    hunks: [
      {
        oldStart: 3,
        newStart: 3,
        lines: [
          ...ctx(`${IM} { signPayload } from "./signature.ts"`),
          ...add(`${IM} { MAX_ATTEMPTS, nextDelayMs } from "./backoff.ts"`),
          ...ctx(``),
          ...del(`const RETRY_DELAY_MS = 30_000
const MAX_ATTEMPTS = 3`),
        ],
      },
      {
        oldStart: 41,
        newStart: 40,
        context: "async function deliver(job: DeliveryJob) {",
        lines: [
          ...ctx(`  if (response.ok) return markDelivered(job)`),
          ...del(`  if (job.attempt < MAX_ATTEMPTS) return queue.retry(job, RETRY_DELAY_MS)`),
          ...add(`  if (job.attempt + 1 < MAX_ATTEMPTS) return queue.retry(job, nextDelayMs(job.attempt))`),
          ...ctx(`  return markFailed(job, response.status)`),
        ],
      },
    ],
  },
  {
    path: "src/webhooks/dispatch.test.ts",
    status: "modified",
    hunks: [
      {
        oldStart: 60,
        newStart: 60,
        lines: [
          ...del(`  it("gives up after three attempts", async () => {`),
          ...add(`  it("gives up after eight attempts", async () => {`),
          ...ctx(`    const job = failingJob()`),
          ...del(`    for (let attempt = 0; attempt < 3; attempt += 1) await deliver(job)`),
          ...add(`    for (let attempt = 0; attempt < 8; attempt += 1) await deliver(job)`),
          ...ctx(`    expect(job.state).toBe("failed")`),
        ],
      },
    ],
  },
  {
    path: "src/config/schema.ts",
    status: "modified",
    hunks: [
      {
        oldStart: 30,
        newStart: 30,
        lines: [
          ...ctx(`  webhooks: Schema.Struct({`),
          ...del(`    retryDelayMs: Schema.Number,`),
          ...add(`    maxAttempts: Schema.optionalWith(Schema.Number, { default: () => 8 }),`),
          ...ctx(`    timeoutMs: Schema.Number,`),
        ],
      },
    ],
  },
  {
    path: "CHANGELOG.md",
    status: "modified",
    hunks: [
      {
        oldStart: 3,
        newStart: 3,
        lines: [
          ...ctx(`## Unreleased
`),
          ...add(`- Webhook retries back off exponentially with jitter, up to 8 attempts.`),
        ],
      },
    ],
  },
]

export const webhookPatch = renderPatch(webhookFiles)

export const apiPaths = [
  ".editorconfig",
  ".github/workflows/ci.yml",
  ".github/workflows/release.yml",
  ".gitignore",
  ".nvmrc",
  "CHANGELOG.md",
  "Dockerfile",
  "README.md",
  "docker-compose.yml",
  "docs/api/authentication.md",
  "docs/api/pagination.md",
  "docs/api/webhooks.md",
  "docs/errors.md",
  "docs/runbooks/database-failover.md",
  "docs/runbooks/rotate-secrets.md",
  "migrations/0001_init.sql",
  "migrations/0002_accounts.sql",
  "migrations/0003_api_tokens.sql",
  "migrations/0004_events.sql",
  "migrations/0005_invoices.sql",
  "migrations/0006_webhooks.sql",
  "migrations/0007_events_index.sql",
  "migrations/0008_token_expiry.sql",
  "package.json",
  "pnpm-lock.yaml",
  "scripts/seed.ts",
  "scripts/smoke.sh",
  "src/auth/api-tokens.test.ts",
  "src/auth/api-tokens.ts",
  "src/auth/hash.ts",
  "src/auth/sessions.ts",
  "src/config/defaults.ts",
  "src/config/index.ts",
  "src/config/schema.ts",
  "src/db/client.ts",
  "src/db/accounts.ts",
  "src/db/api-tokens.ts",
  "src/db/events.ts",
  "src/db/invoices.ts",
  "src/db/transactions.ts",
  "src/http/errors.ts",
  "src/http/health.ts",
  "src/http/middleware/cors.ts",
  "src/http/middleware/index.ts",
  "src/http/middleware/request-id.ts",
  "src/http/middleware/timing.ts",
  "src/http/server.ts",
  "src/jobs/billing.ts",
  "src/jobs/rollups.ts",
  "src/jobs/scheduler.test.ts",
  "src/jobs/scheduler.ts",
  "src/main.ts",
  "src/metrics/counters.ts",
  "src/metrics/registry.ts",
  "src/routes/admin/accounts.ts",
  "src/routes/admin/index.ts",
  "src/routes/admin/tokens.ts",
  "src/routes/public/events.ts",
  "src/routes/public/index.ts",
  "src/routes/public/invoices.ts",
  "src/routes/public/webhooks.ts",
  "src/search/index.ts",
  "src/search/query.ts",
  "src/webhooks/dispatch.test.ts",
  "src/webhooks/dispatch.ts",
  "src/webhooks/payload.ts",
  "src/webhooks/signature.ts",
  "test/fixtures/accounts.json",
  "test/fixtures/invoices.json",
  "test/helpers/request.ts",
  "test/setup.ts",
  "tsconfig.json",
  "vitest.config.ts",
]

export const rateLimitTree: (string | GitTreeFile)[] = (() => {
  const changed = new Map<string, GitTreeFile>(
    rateLimitFiles.map((file) => [
      file.path,
      file.from === undefined
        ? { path: file.path, status: file.status }
        : { path: file.path, status: file.status, from: file.from },
    ]),
  )
  const all = new Set([...apiPaths, ...changed.keys()])
  return [...all].toSorted().map((path) => changed.get(path) ?? path)
})()

export const rateLimitChangedPaths = rateLimitFiles.map((file) => file.path)

/** `null` for a file the commit didn't change. */
export function rateLimitPatchOf(path: string): string | null {
  const file = rateLimitFiles.find((entry) => entry.path === path)
  return file === undefined ? null : renderPatch([file])
}

const tsLines = [
  "  const result = await db.query(sql, params)",
  "  if (result.rows.length === 0) return notFound(context)",
  '  const account = await accounts.byId(context.get("apiToken").accountId)',
  '  logger.info({ requestId, route: context.req.routePath }, "handled")',
  "  return context.json({ data: rows.map(toPublic), next: cursorOf(rows) })",
  '  const limit = Math.min(Number(context.req.query("limit") ?? 50), 200)',
  "  await tx.events.insert({ accountId, kind, payload, createdAt: new Date() })",
  "  if (!parsed.success) return unprocessable(context, parsed.issues)",
  "  const settings = await cache.getOrSet(`tenant:${tenantId}`, () => load(tenantId), 30_000)",
  "  throw new ConflictError(`slug ${slug} is taken`)",
  "  for (const chunk of chunks(rows, 500)) await stream.write(toCsv(chunk))",
  "  return retryOnce(() => db.transaction(work), isSerializationFailure)",
  "  const expiresAt = token.expiresAt ?? null",
  "  metrics.jobDuration.observe({ job: name }, performance.now() - started)",
]

const sqlLines = [
  "CREATE INDEX IF NOT EXISTS events_account_created ON events (account_id, created_at);",
  "ALTER TABLE api_tokens ADD COLUMN expires_at timestamptz;",
  "UPDATE invoices SET total_minor = round(total * 100);",
  "ALTER TABLE events RENAME COLUMN customer_id TO account_id;",
]

const mdLines = [
  "Pages are ordered by creation time; pass `cursor` from the previous response.",
  "Tokens can expire; an expired token answers 401 `token_expired`.",
  "Webhook payloads are signed with the endpoint secret in `x-acme-signature`.",
  "Exports stream as CSV, 500 rows per chunk.",
]

function linesFor(path: string, random: () => number, count: number): string[] {
  const pool = path.endsWith(".sql") ? sqlLines : path.endsWith(".md") ? mdLines : tsLines
  return Array.from({ length: count }, () => pool[Math.floor(random() * pool.length)] as string)
}

const sources = apiPaths.filter((path) => /^(src|migrations|docs)\//.test(path))

export function commitPatch(commit: Commit): string {
  if (commit.id === RATE_LIMIT_COMMIT.id) return rateLimitPatch
  const random = lcg(Number.parseInt(commit.id.slice(0, 8), 16))
  const count = Math.max(1, Math.min(commit.stats?.files ?? 3, 6))
  const picked = new Set<string>()
  while (picked.size < count) picked.add(sources[Math.floor(random() * sources.length)] as string)
  const files: PatchFile[] = [...picked].map((path) => {
    const start = 8 + Math.floor(random() * 80)
    const removed = Math.floor(random() * 4)
    const added = 1 + Math.floor(random() * 6)
    return {
      path,
      status: "modified",
      hunks: [
        {
          oldStart: start,
          newStart: start,
          lines: [
            ...ctx(linesFor(path, random, 2).join("\n")),
            ...(removed > 0 ? del(linesFor(path, random, removed).join("\n")) : []),
            ...add(linesFor(path, random, added).join("\n")),
            ...ctx(linesFor(path, random, 2).join("\n")),
          ],
        },
      ],
    }
  })
  return renderPatch(files)
}

const appPool = {
  subjects: [
    "Show the plan picker on the second onboarding step",
    "Fix the focus ring on the invite form",
    "Load invoices with the cursor API",
    "Translate the billing page to Spanish",
    "Remember the last project in local storage",
    "Debounce the search box on the events page",
    "Replace the date picker on the export dialog",
    "Show rate-limit errors as a toast",
    "Split `src/pages/settings.tsx` by section",
    "Bump the design tokens to 3.2",
    "Skip the welcome step for invited members",
    "Fix the dark-mode chart colours",
    "Prefetch the account on hover",
    "Add an empty state to the webhooks page",
    "Retry failed uploads from the import dialog",
    "Keep the sidebar collapsed across reloads",
    "Test the onboarding flow end to end",
    "Show the API token's expiry date",
  ],
  topics: ["feat/plan-picker", "fix/invite-focus", "feat/cursor-invoices", "chore/settings-split", "feat/es-billing"],
  tags: [
    [12, "app-4.8.0"],
    [140, "app-4.7.0"],
  ] as [number, string][],
}

export const appCommits: Commit[] = generateHistory(260, 19, Date.parse(NOW) - 3 * HOUR, appPool).commits

const stagedFiles: PatchFile[] = [
  {
    path: "src/onboarding/step-indicator.tsx",
    status: "added",
    hunks: [
      {
        oldStart: 0,
        newStart: 1,
        lines: add(`${IM} { cn } from "@/lib/utils"

type StepIndicatorProps = { steps: readonly string[]; current: number }

export function StepIndicator({ steps, current }: StepIndicatorProps) {
  return (
    <ol className="flex items-center gap-2" aria-label="Onboarding progress">
      {steps.map((step, index) => (
        <li
          key={step}
          aria-current={index === current ? "step" : undefined}
          className={cn("h-1.5 flex-1 rounded-full bg-muted", index <= current && "bg-primary")}
        >
          <span className="sr-only">{step}</span>
        </li>
      ))}
    </ol>
  )
}`),
      },
    ],
  },
  {
    path: "src/onboarding/steps.tsx",
    status: "modified",
    hunks: [
      {
        oldStart: 3,
        newStart: 3,
        lines: [
          ...ctx(`${IM} { PlanPicker } from "./plan-picker.tsx"`),
          ...add(`${IM} { StepIndicator } from "./step-indicator.tsx"`),
          ...ctx(`${IM} { WorkspaceForm } from "./workspace-form.tsx"`),
        ],
      },
      {
        oldStart: 41,
        newStart: 42,
        context: "export function OnboardingSteps() {",
        lines: [
          ...ctx(`  return (
    <section className="flex flex-col gap-6">`),
          ...del(`      <p className="text-sm text-muted-foreground">Step {current + 1} of {STEPS.length}</p>`),
          ...add(`      <StepIndicator steps={STEPS} current={current} />`),
          ...ctx(`      {renderStep(STEPS[current])}`),
        ],
      },
    ],
  },
]

const unstagedFiles: PatchFile[] = [
  {
    path: "src/onboarding/steps.tsx",
    status: "modified",
    hunks: [
      {
        oldStart: 18,
        newStart: 18,
        lines: [
          ...ctx(`const STEPS = [`),
          ...del(`  "Create a workspace",
  "Pick a plan",`),
          ...add(`  "Name your workspace",
  "Choose a plan",`),
          ...ctx(`  "Invite your team",
]`),
        ],
      },
    ],
  },
  {
    path: "src/i18n/en.json",
    status: "modified",
    hunks: [
      {
        oldStart: 112,
        newStart: 112,
        lines: [
          ...ctx(`  "onboarding.title": "Set up Acme",`),
          ...del(`  "onboarding.step": "Step {current} of {total}",`),
          ...add(`  "onboarding.progress": "Onboarding progress",
  "onboarding.workspace": "Name your workspace",
  "onboarding.plan": "Choose a plan",`),
          ...ctx(`  "onboarding.invite": "Invite your team",`),
        ],
      },
    ],
  },
  {
    path: "src/onboarding/steps.test.tsx",
    status: "modified",
    hunks: [
      {
        oldStart: 22,
        newStart: 22,
        lines: [
          ...ctx(`  it("moves to the next step", async () => {
    render(<OnboardingSteps />)
    await user.click(screen.getByRole("button", { name: "Continue" }))`),
          ...del(`    expect(screen.getByText("Step 2 of 3")).toBeVisible()`),
          ...add(`    expect(screen.getByRole("listitem", { current: "step" })).toHaveTextContent("Choose a plan")`),
          ...ctx(`  })`),
        ],
      },
    ],
  },
]

export type Worktree = {
  staged: { files: number; patch: string }
  unstaged: { files: number; patch: string }
}

export const appWorktree: Worktree = {
  staged: { files: stagedFiles.length, patch: renderPatch(stagedFiles) },
  unstaged: { files: unstagedFiles.length, patch: renderPatch(unstagedFiles) },
}

export const appBranches = [
  { name: "feat/onboarding-steps", ahead: 2, behind: 7, pushed: true },
  { name: "main", ahead: 0, behind: 0, pushed: true },
  { name: "fix/invite-focus", ahead: 1, behind: 3, pushed: false },
]
