import type { Commit } from "@/lib/commit-graph"

const minutesAgo = (now: number, minutes: number) => now - minutes * 60_000

/** The commit trail of the reference frames: a release, an expandable merge, a fix with details, another merge. */
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

/**
 * `count` commits in `git log --topo-order` shape: a mainline where every tenth commit merges a branch of eight,
 * every fiftieth of those branches merges a short branch of its own, and every 500th merge is an octopus.
 */
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

export { generatedCommits, pendingCommit, trailCommits }
