import {
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  type DialogSize,
} from "@/components/ui/dialog"

import { Section } from "../section"

const sizes: { size: DialogSize; width: string }[] = [
  { size: "sm", width: "24rem" },
  { size: "md", width: "32rem, the default" },
  { size: "lg", width: "48rem" },
  { size: "xl", width: "72rem" },
  { size: "full", width: "the page less the floating offset" },
]

const paragraphs = Array.from(
  { length: 12 },
  (_, index) =>
    `Paragraph ${index + 1}. The header and footer stay in view while this body scrolls; on a narrow screen the dialog rises from the bottom as a sheet.`,
)

function SizedDialog({ size, width }: { size: DialogSize; width: string }) {
  return (
    <Dialog>
      <DialogTrigger aria-label={`Open ${size}`}>{size}</DialogTrigger>
      <DialogBackdrop />
      <DialogContent size={size}>
        <DialogHeader>
          <DialogTitle>Size {size}</DialogTitle>
          <DialogDescription>Up to {width} wide.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <p className="font-mono text-sm">
            sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a089f86d081884c7d659a2feaa0c55ad015
          </p>
          {paragraphs.map((paragraph) => (
            <p key={paragraph} className="text-sm">
              {paragraph}
            </p>
          ))}
        </DialogBody>
        <DialogFooter>
          <DialogClose>Close</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DialogSizesSection() {
  return (
    <Section
      title="Dialog sizes"
      description="DialogContent size sm, md (default), lg, xl or full. DialogBody scrolls between a fixed header and footer, long unbroken text wraps instead of widening the dialog, and on narrow screens the dialog is a bottom sheet unless sheet={false}."
    >
      {sizes.map(({ size, width }) => (
        <SizedDialog key={size} size={size} width={width} />
      ))}
    </Section>
  )
}

export { DialogSizesSection }
