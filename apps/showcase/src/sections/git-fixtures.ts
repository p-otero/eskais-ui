import type { CommitBranch } from "@/lib/commit-branches"
import type { Commit } from "@/lib/commit-graph"

const minutesAgo = (now: number, minutes: number) => now - minutes * 60_000

function trailCommits(now: number): Commit[] {
  return [
    {
      id: "a41f0e2c9b",
      parents: ["5c0d1be77a"],
      message: "Bump version in `package.json`",
      date: minutesAgo(now, 26),
      author: "Ines Ortega",
      body: "Release 2.4.0.",
      stats: { files: 1, additions: 1, deletions: 1 },
      tags: [{ label: "Release", tone: "violet" }],
    },
    {
      id: "5c0d1be77a",
      parents: ["e02c6d9f31", "9b7e2a1c04"],
      message: "Merge invoice-pdf into main",
      date: minutesAgo(now, 38),
      author: "Kai Brandt",
      body: "Invoices export as PDF, with embedded fonts.",
    },
    {
      id: "9b7e2a1c04",
      parents: ["71c3d9e0aa"],
      message: "Render line items as a PDF table",
      date: minutesAgo(now, 41),
      author: "Kai Brandt",
      stats: { files: 3, additions: 112, deletions: 4 },
    },
    {
      id: "71c3d9e0aa",
      parents: ["3e8f4b62d1"],
      message: "Embed fonts in invoice exports",
      date: minutesAgo(now, 43),
      author: "Kai Brandt",
      stats: { files: 2, additions: 27, deletions: 0 },
    },
    {
      id: "3e8f4b62d1",
      parents: ["e02c6d9f31"],
      message: "Add the PDF route in `routes.ts`",
      date: minutesAgo(now, 46),
      author: "Kai Brandt",
      stats: { files: 1, additions: 14, deletions: 0 },
    },
    {
      id: "e02c6d9f31",
      parents: ["c7a9015e6b"],
      message: "Fix rounding in `proration.ts`",
      date: minutesAgo(now, 44),
      author: "Kai Brandt",
      body: "Prorations now round half to even, so a mid-month upgrade never charges a cent too much.",
      stats: { files: 2, additions: 18, deletions: 9 },
      tags: [{ label: "Fix", tone: "warning" }],
    },
    {
      id: "c7a9015e6b",
      parents: ["8d24f7a0c3", "f19b3c8e52"],
      message: "Merge tax-rates into main",
      date: minutesAgo(now, 48),
      author: "Ines Ortega",
    },
    {
      id: "f19b3c8e52",
      parents: ["8d24f7a0c3"],
      message: "Load EU VAT rates from `rates.json`",
      date: minutesAgo(now, 52),
      author: "Ines Ortega",
      stats: { files: 2, additions: 64, deletions: 2 },
    },
    {
      id: "8d24f7a0c3",
      parents: [],
      message: "Create the billing service",
      date: minutesAgo(now, 90),
      author: "Ines Ortega",
      stats: { files: 12, additions: 410, deletions: 0 },
    },
  ]
}

function pendingCommit(now: number, parent: string): Commit {
  return {
    id: "pending-retry-webhooks",
    parents: [parent],
    message: "Retry failed webhooks in `queue.ts`",
    date: now,
    author: "Ines Ortega",
    status: "pending",
  }
}

/** `count` commits in `git log --topo-order` shape: every tenth mainline commit merges a branch of eight. */
function generatedCommits(count: number, now = Date.now()): Commit[] {
  const commits: Commit[] = []
  const subjects = ["Fix rounding in `proration.ts`", "Add tests for `queue.ts`", "Refactor the invoice exporter"]
  let main = 0
  while (commits.length < count) {
    const at = main
    const self = `m${String(at)}`
    const next = `m${String(at + 1)}`
    const time = now - commits.length * 60_000
    if (at % 10 === 9) {
      const octopus = at % 5000 === 4999
      const branch = `b${String(at)}`
      const parents = octopus ? [next, `${branch}-8`, `${branch}x-1`] : [next, `${branch}-8`]
      commits.push({ id: self, parents, message: `Merge feature-${String(at)} into main`, date: time })
      for (let step = 8; step >= 1; step -= 1) {
        const nested = at % 500 === 499 && step === 5
        const parent = step === 1 ? next : `${branch}-${String(step - 1)}`
        commits.push({
          id: `${branch}-${String(step)}`,
          parents: nested ? [parent, `${branch}n-2`] : [parent],
          message: `Step ${String(step)} of feature ${String(at)}`,
          date: time - step * 1000,
        })
        if (nested) {
          commits.push({ id: `${branch}n-2`, parents: [`${branch}n-1`], message: "Nested work", date: time - 1 })
          commits.push({ id: `${branch}n-1`, parents: [parent], message: "Nested start", date: time - 2 })
        }
      }
      if (octopus) commits.push({ id: `${branch}x-1`, parents: [next], message: "Octopus arm", date: time - 9000 })
    } else {
      commits.push({
        id: self,
        parents: [next],
        message: subjects[at % subjects.length] ?? "",
        date: time,
        tags: at % 97 === 0 ? [{ label: "Release", tone: "violet" }] : undefined,
      })
    }
    main += 1
  }
  return commits.slice(0, count)
}

const branchCommit = (now: number, id: string, parent: string, message: string, minutes: number, author: string) =>
  ({ id, parents: [parent], message, date: minutesAgo(now, minutes), author }) satisfies Commit

/** As `git log --all --topo-order` lists them: each branch's own commits before the main commit they forked from. */
function branchHistory(now: number): { commits: Commit[]; branches: CommitBranch[] } {
  const main = trailCommits(now)
  const at = (id: string) => main.findIndex((commit) => commit.id === id)
  const webhooks = [
    branchCommit(now, "w3c1a0e5d2", "w2b9f4c7a1", "Back off with jitter in `retry.ts`", 4, "Ines Ortega"),
    branchCommit(now, "w2b9f4c7a1", "w1a8e3b6f0", "Retry failed webhooks in `queue.ts`", 9, "Ines Ortega"),
    branchCommit(now, "w1a8e3b6f0", "a41f0e2c9b", "Store delivery attempts", 14, "Ines Ortega"),
  ]
  const usage = [
    branchCommit(now, "u2d4c6e8a0", "u1c3b5d7f9", "Stream usage rows as CSV", 31, "Kai Brandt"),
    branchCommit(now, "u1c3b5d7f9", "e02c6d9f31", "Add the usage export route in `routes.ts`", 35, "Kai Brandt"),
  ]
  const cents = [branchCommit(now, "c1e5f7a9b3", "e02c6d9f31", "Keep proration in integer cents", 20, "Ada Lin")]
  const cache = [
    branchCommit(now, "k2f8a1c4e6", "k1e7f0b3d5", "Cache invoice PDFs at the edge", 60 * 24 * 41, "Ada Lin"),
    branchCommit(now, "k1e7f0b3d5", "8d24f7a0c3", "Spike: edge cache headers", 60 * 24 * 45, "Ada Lin"),
  ]
  const commits = [
    ...webhooks,
    ...cents,
    ...main.slice(0, at("e02c6d9f31")),
    ...usage,
    ...main.slice(at("e02c6d9f31"), at("8d24f7a0c3")),
    ...cache,
    ...main.slice(at("8d24f7a0c3")),
  ]
  const branches: CommitBranch[] = [
    { name: "main", head: "a41f0e2c9b" },
    { name: "feature/webhook-retries", head: "w3c1a0e5d2" },
    { name: "feature/usage-export", head: "u2d4c6e8a0" },
    { name: "fix/proration-cents", head: "c1e5f7a9b3", tone: "warning" },
    { name: "spike/edge-cache", head: "k2f8a1c4e6" },
    { name: "release/2.4", head: "a41f0e2c9b" },
    { name: "invoice-pdf", head: "9b7e2a1c04" },
  ]
  return { commits, branches }
}

/** `count` mainline commits with `branchCount` branches of 5 to 11 commits forking along it. */
function branchedCommits(count: number, branchCount: number, now = Date.now()) {
  const spacing = Math.max(1, Math.floor((count * 0.9) / branchCount))
  const plans = Array.from({ length: branchCount }, (_, index) => ({
    name: `feature/${String(index + 1).padStart(3, "0")}`,
    fork: 20 + index * spacing,
    ahead: 5 + (index % 7),
    top: index % 2 === 0,
  }))
  const own = plans.reduce((sum, plan) => sum + plan.ahead, 0)
  const length = Math.max(1, count - own)
  const above = new Map<number, Commit[]>()
  for (const plan of plans) {
    const commits = Array.from({ length: plan.ahead }, (_, step): Commit => {
      const at = plan.ahead - step
      return {
        id: `${plan.name}-${String(at)}`,
        parents: [at === 1 ? `m${String(plan.fork)}` : `${plan.name}-${String(at - 1)}`],
        message: `Step ${String(at)} on ${plan.name}`,
        date: now - (plan.fork - 1) * 60_000 + at * 1000,
      }
    })
    const slot = plan.top ? 0 : Math.max(0, plan.fork - 3)
    above.set(slot, [...(above.get(slot) ?? []), ...commits])
  }
  const commits: Commit[] = []
  for (let index = 0; index < length; index += 1) {
    commits.push(...(above.get(index) ?? []))
    commits.push({
      id: `m${String(index)}`,
      parents: index === length - 1 ? [] : [`m${String(index + 1)}`],
      message: `Mainline change ${String(index)}`,
      date: now - index * 60_000,
    })
  }
  const branches: CommitBranch[] = [
    { name: "main", head: "m0" },
    ...plans.map((plan) => ({ name: plan.name, head: `${plan.name}-${String(plan.ahead)}` })),
  ]
  return { commits, branches }
}

export { branchedCommits, branchHistory, generatedCommits, pendingCommit, trailCommits }
