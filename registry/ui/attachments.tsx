"use client"

import type { ChangeDetails } from "@ui-sdk/core"
import { Button } from "@ui-sdk/react/button"
import { usePart, usePrimitive, type PartProps } from "@ui-sdk/react/primitive"
import { useEffect, useMemo, useRef, useState } from "react"

import {
  AttachmentThumb,
  type AttachmentSize,
  formatFileSize,
  type AttachmentThumbProps,
} from "@/components/ui/attachment-thumb"
import {
  attachments as attachmentsPrimitive,
  type Attachment,
  type AttachmentOpenReason,
} from "@/components/ui/attachments-primitive"
import { Lightbox, type LightboxItem, type LightboxLabels } from "@/components/ui/lightbox"
import { cn } from "@/lib/utils"

type AttachmentLabels = {
  /** The accessible name of an image's button. */
  open: (name: string) => string
  /** The accessible name of the "+N" button that shows the rest. */
  more: (count: number) => string
  lightbox?: Partial<LightboxLabels>
}

const attachmentLabels: AttachmentLabels = {
  open: (name) => `Open ${name}`,
  more: (count) => `Show ${count} more attachments`,
}

type AttachmentStripProps = Omit<PartProps<"div">, "children" | "onSelect"> & {
  attachments: readonly Attachment[]
  /** Runs before an attachment opens, for a person or an agent; `details.cancel()` keeps it closed. */
  onOpen?: (attachment: Attachment, details: ChangeDetails<AttachmentOpenReason>) => void
  /** Shows this many, then a "+N" button for the rest. */
  max?: number
  size?: AttachmentSize
  labels?: Partial<AttachmentLabels>
  locale?: string
  /** Names the strip, for screen readers and agents. */
  "aria-label": string
}

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"

// Data attributes aren't in the part's prop type, so they come in through a spread.
function rootAttributes(size: AttachmentSize) {
  return { "data-slot": "attachment-strip", "data-size": size }
}

function AttachmentStrip({
  attachments,
  onOpen,
  max,
  size = "md",
  labels: labelOverrides,
  locale,
  className,
  ...props
}: AttachmentStripProps) {
  const labels = { ...attachmentLabels, ...labelOverrides }
  const list = useRef<HTMLUListElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [viewer, setViewer] = useState({ open: false, index: 0, id: "" })
  const revealed = useRef(false)
  const images = useMemo<LightboxItem[]>(
    () =>
      attachments
        .filter((attachment) => attachment.kind === "image")
        .map(({ id, src, srcDark, alt, name, href }) => ({ id, src, srcDark, alt, name, href })),
    [attachments],
  )

  const handle = usePrimitive(attachmentsPrimitive, {
    attachments,
    onOpen,
    open: (attachment, event) => {
      if (attachment.kind === "image") {
        setViewer({ open: true, index: images.findIndex((image) => image.id === attachment.id), id: attachment.id })
      } else if (!event && attachment.href) {
        globalThis.open(attachment.href, "_blank", "noopener,noreferrer")
      }
    },
  })

  const hidden = max !== undefined && !expanded ? Math.max(attachments.length - max, 0) : 0
  const shown = hidden > 0 ? attachments.slice(0, max) : attachments

  useEffect(() => {
    if (!expanded || !revealed.current || max === undefined) return
    revealed.current = false
    const first = attachments[max]
    list.current?.querySelector<HTMLElement>(`[data-attachment-id="${CSS.escape(first?.id ?? "")}"]`)?.focus()
  }, [expanded, attachments, max])

  const children = (
    <>
      <ul
        ref={list}
        data-slot="attachment-list"
        className="-m-inline flex min-w-0 items-center gap-items overflow-x-auto overscroll-x-contain p-inline"
      >
        {shown.map((attachment) => (
          <li key={attachment.id} className="flex shrink-0">
            <AttachmentThumb
              attachment={attachment}
              size={size}
              locale={locale}
              openLabel={labels.open}
              onOpen={(_, event) => {
                const opened = handle.api.openAttachment(attachment.id, {
                  reason: "item-press",
                  event: event.nativeEvent,
                })
                if (!opened) event.preventDefault()
              }}
            />
          </li>
        ))}
        {hidden > 0 && (
          <li className="flex shrink-0">
            <Button
              data-slot="attachment-more"
              aria-label={labels.more(hidden)}
              onClick={() => {
                revealed.current = true
                setExpanded(true)
              }}
              className={cn(
                "touch-target flex shrink-0 cursor-pointer items-center justify-center rounded-lg border border-dashed bg-muted/(--glass-opacity) px-inset-item text-body-sm font-medium text-muted-foreground tabular-nums transition-colors hover:bg-accent hover:text-accent-foreground",
                size === "sm" ? "h-12 min-w-12" : "h-20 min-w-20",
                focusRing,
              )}
            >
              +{hidden}
            </Button>
          </li>
        )}
      </ul>
      {images.length > 0 && (
        <Lightbox
          items={images}
          index={viewer.index}
          onIndexChange={(index) => setViewer((current) => ({ ...current, index }))}
          open={viewer.open}
          onOpenChange={(open) => setViewer((current) => ({ ...current, open }))}
          finalFocus={() =>
            list.current?.querySelector<HTMLElement>(`[data-attachment-id="${CSS.escape(viewer.id)}"]`) ?? undefined
          }
          labels={labels.lightbox}
        />
      )}
    </>
  )

  return usePart(
    handle,
    "root",
    {},
    { ...props, ...rootAttributes(size), className: cn("flex min-w-0", className), children },
    "div",
  )
}

export { AttachmentStrip, attachmentLabels }
export { AttachmentThumb, formatFileSize }
export type { AttachmentLabels, AttachmentStripProps }
export type { AttachmentSize, AttachmentThumbProps }
export type { Attachment, AttachmentOpenReason }
