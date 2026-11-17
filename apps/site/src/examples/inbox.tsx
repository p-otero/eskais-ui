import { Inbox } from "@/components/inbox"
import { sampleInboxItems } from "@/components/inbox-sample"

const items = sampleInboxItems(1500)

export default function InboxDemo() {
  return <Inbox items={items} locale="en-US" timeZone="UTC" className="h-128 w-full" />
}
