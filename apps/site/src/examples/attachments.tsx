import { useState } from "react"

import { AttachmentStrip, type Attachment } from "@/components/ui/attachments"

import { screenshots } from "./fixtures"

const attachments: Attachment[] = [
  ...screenshots.map((shot) => ({ ...shot, kind: "image" as const, name: shot.name ?? shot.id })),
  { id: "repro", kind: "file", name: "import-repro-steps.md", src: "#repro", href: "#repro", alt: "", size: 3_812 },
  { id: "har", kind: "file", name: "network-trace.har", src: "#har", href: "#har", alt: "", size: 1_842_000 },
]

export default function AttachmentsDemo() {
  const [opened, setOpened] = useState<string>()
  return (
    <div className="flex w-full min-w-0 flex-col gap-items">
      <AttachmentStrip
        aria-label="Bug report attachments"
        attachments={attachments}
        max={5}
        locale="en"
        onOpen={(attachment, details) => setOpened(`${attachment.name} (${details.source})`)}
      />
      <p className="text-body-sm text-muted-foreground" aria-live="polite">
        {opened ? `Opened ${opened}` : "Open an image or a file."}
      </p>
    </div>
  )
}
