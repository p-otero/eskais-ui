import { Inbox } from "@/components/inbox"
import { sampleInboxItems } from "@/components/inbox-sample"

import { Section } from "../section"

const items = sampleInboxItems(1500)

function InboxDemo() {
  return (
    <main className="flex h-dvh flex-col p-inset-surface">
      <Inbox items={items} locale="en-US" timeZone="UTC" className="min-h-0 flex-1" />
    </main>
  )
}

function InboxSection() {
  return (
    <Section
      title="Inbox"
      description="1,500 messages, virtualized. Focus a row: j/k or the arrows move, Enter opens the inspector, U and P act on it, Esc closes it, x selects, ? lists every key."
    >
      <Inbox items={items} locale="en-US" timeZone="UTC" className="h-128 w-full" />
    </Section>
  )
}

export { InboxDemo, InboxSection }
