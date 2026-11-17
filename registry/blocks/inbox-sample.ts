import type { Tone } from "@/lib/tone"

type InboxItem = {
  id: string
  from: string
  subject: string
  preview: string
  /** ISO date-time. */
  receivedAt: string
  read: boolean
  pinned: boolean
  label?: { text: string; tone: Tone }
}

const senders = [
  "Maya Kowalski",
  "Arjun Shah",
  "Lena Torres",
  "Jonas Richter",
  "Amara Okafor",
  "Wei Chen",
  "Sofia Marino",
  "Deploy bot",
  "Billing",
  "Security alerts",
]

const topics = [
  "Webhook retries stop after the first timeout",
  "Audit log export misses rows past 10,000",
  "Seat count on the billing page is a month behind",
  "Search index warms on every deploy",
  "Review requested on the onboarding checklist",
  "Quarterly access review is due",
  "Staging certificate expires in 7 days",
  "New comment on the pricing page copy",
  "Invoice for the design tooling seats",
  "Incident follow-up: cache stampede on Monday",
  "Can we move the roadmap sync to Thursday?",
  "Dependency update: 14 packages behind",
]

const previews = [
  "I traced it to the load balancer answering with a 502 before our handler runs.",
  "Attached the export from last night; rows stop at exactly 10,000.",
  "Looks like we read the cached plan instead of the live subscription.",
  "Happy to pair on it tomorrow morning if that helps.",
  "Nothing urgent, but it would be good to settle before the release.",
  "The checklist is in the doc; I left two questions inline.",
]

const labels: InboxItem["label"][] = [
  { text: "Bug", tone: "destructive" },
  { text: "Review", tone: "info" },
  { text: "Billing", tone: "violet" },
  undefined,
  undefined,
  { text: "Ops", tone: "warning" },
]

// A small deterministic generator, so demos and screenshots look the same on every load.
function random(seed: number) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
  }
}

function pick<T>(list: readonly T[], next: () => number): T {
  return list[Math.floor(next() * list.length)] as T
}

/** Sample messages for demos and tests, newest first, ending at `now`. */
function sampleInboxItems(count: number, now = "2026-11-16T09:30:00Z"): InboxItem[] {
  const next = random(count)
  let time = Date.parse(now)
  return Array.from({ length: count }, (_, index) => {
    time -= Math.floor(next() * 90 + 5) * 60_000
    return {
      id: `MSG-${String(count - index).padStart(4, "0")}`,
      from: pick(senders, next),
      subject: pick(topics, next),
      preview: pick(previews, next),
      receivedAt: new Date(time).toISOString(),
      read: index > 6 && next() > 0.25,
      pinned: next() > 0.94,
      label: pick(labels, next),
    }
  })
}

export { sampleInboxItems }
export type { InboxItem }
