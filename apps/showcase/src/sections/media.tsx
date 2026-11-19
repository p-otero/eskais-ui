import { useState } from "react"

import { Button } from "@ui-sdk/react/button"
import { AttachmentStrip, type Attachment } from "@/components/ui/attachments"
import { Lightbox, ThemedImage } from "@/components/ui/lightbox"

import { Section } from "../section"
import { ImageScanSection } from "./image-scan"
import { ModelScanSection, ModelViewerSection } from "./model-viewer"
import { screenshots } from "./media-fixtures"

function LightboxSection() {
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  return (
    <Section
      title="Lightbox"
      description="A dialog for one image of a set: arrow keys, a counter, fit or actual size, and the original. Dark screenshots follow the theme."
    >
      <ul className="flex flex-wrap gap-2" aria-label="Release screenshots">
        {screenshots.map((shot, position) => (
          <li key={shot.id}>
            <Button
              aria-label={`View ${shot.name}`}
              className="block h-24 w-36 cursor-pointer overflow-hidden rounded-control border outline-none hover:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              onClick={() => {
                setIndex(position)
                setOpen(true)
              }}
            >
              <ThemedImage src={shot.src} srcDark={shot.srcDark} alt="" className="size-full object-cover" />
            </Button>
          </li>
        ))}
      </ul>
      <Lightbox items={screenshots} index={index} onIndexChange={setIndex} open={open} onOpenChange={setOpen} />
    </Section>
  )
}

const attachments: Attachment[] = [
  ...screenshots.map((shot) => ({ ...shot, kind: "image" as const, name: shot.name ?? shot.id })),
  {
    id: "repro",
    kind: "file",
    name: "import-repro-steps.md",
    src: "#repro",
    href: "#repro",
    alt: "",
    size: 3_812,
    mimeType: "text/markdown",
  },
  { id: "har", kind: "file", name: "network-trace.har", src: "#har", href: "#har", alt: "", size: 1_842_000 },
  { id: "csv", kind: "file", name: "failed-rows.csv", src: "#csv", href: "#csv", alt: "", size: 96_400 },
]

function AttachmentsSection() {
  const [opened, setOpened] = useState<string>()
  return (
    <Section
      title="Attachments"
      description="A scrolling strip of image thumbnails and file chips. Images open the lightbox; files open their link. Agents call openAttachment."
    >
      <div className="flex w-full min-w-0 flex-col gap-4">
        <AttachmentStrip
          aria-label="Bug report attachments"
          attachments={attachments}
          max={5}
          locale="en"
          onOpen={(attachment, details) => setOpened(`${attachment.name} (${details.source})`)}
        />
        <AttachmentStrip aria-label="Compact attachments" size="sm" locale="en" attachments={attachments.slice(1, 6)} />
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {opened ? `Opened ${opened}` : "Open an image or a file."}
        </p>
      </div>
    </Section>
  )
}

function MediaSections() {
  return (
    <>
      <LightboxSection />
      <AttachmentsSection />
      <ImageScanSection />
      <ModelViewerSection />
      <ModelScanSection />
    </>
  )
}

export { AttachmentsSection, LightboxSection, MediaSections }
