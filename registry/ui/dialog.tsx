"use client"

import {
  Dialog,
  DialogBackdrop as DialogBackdropPrimitive,
  DialogClose as DialogClosePrimitive,
  DialogContent as DialogContentPrimitive,
  DialogDescription as DialogDescriptionPrimitive,
  DialogTitle as DialogTitlePrimitive,
  DialogTrigger as DialogTriggerPrimitive,
  createDialogController,
} from "@ui-sdk/react/dialog"
import { mergeProps, renderElement, type PartProps } from "@ui-sdk/react/primitive"
import { cva, type VariantProps } from "class-variance-authority"
import { useCallback, useRef, type ComponentProps, type ReactNode, type Ref, type RefObject } from "react"

import { buttonVariants, type ButtonLookProps } from "@/components/ui/button"
import { ScrollArea, ScrollAreaScrollbar, ScrollAreaViewport } from "@/components/ui/scroll-area"
import { ControlTooltip } from "@/components/ui/tooltip"
import {
  focusedElement,
  mayReturnFocus,
  useRecordFocusMove,
  useRecordOpener,
  type FocusMemory,
} from "@/components/ui/use-dialog-focus"
import { cn, cnState } from "@/lib/utils"

// While they animate out, the backdrop and content let presses through, so the first click on the page counts.
const backdropClassName =
  "fixed inset-0 z-overlay bg-overlay transition-opacity duration-dialog ease-standard data-ending-style:pointer-events-none data-ending-style:opacity-0 data-starting-style:opacity-0"

// Sizes and offsets come from the containing block (the viewport for a top-layer dialog) through %, never viewport units.
const dialogContentVariants = cva(
  [
    // oxlint-disable-next-line eskais/scroll-area -- the dialog element's fallback for content without a DialogBody, which is the scroll area
    "fixed inset-0 z-overlay m-auto flex h-fit max-h-(--dialog-max-height) w-(--dialog-width) min-w-0 flex-col gap-group overflow-y-auto overscroll-contain rounded-floating border border-floating-border bg-popover p-inset-surface field-label-surface-popover text-popover-foreground wrap-anywhere shadow-floating outline-none transition duration-dialog ease-standard data-ending-style:pointer-events-none data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
  ],
  {
    variants: {
      size: {
        sm: "max-w-sm",
        md: "max-w-lg",
        lg: "max-w-3xl",
        xl: "max-w-6xl",
        full: "h-(--dialog-max-height) max-w-none",
      },
      sheet: {
        true: "narrow:top-auto narrow:mb-0 narrow:h-fit narrow:max-h-(--sheet-max-height) narrow:w-full narrow:max-w-none narrow:rounded-b-none narrow:border-b-0 narrow:data-ending-style:translate-y-full narrow:data-ending-style:scale-100 narrow:data-starting-style:translate-y-full narrow:data-starting-style:scale-100 narrow:motion-reduce:data-ending-style:translate-y-0 narrow:motion-reduce:data-starting-style:translate-y-0",
        false: "",
      },
    },
    defaultVariants: { size: "md", sheet: true },
  },
)

/** The default content look (`md`, a bottom sheet on narrow screens), for an AlertDialog or other content part. */
const contentClassName = dialogContentVariants()

type DialogSize = NonNullable<VariantProps<typeof dialogContentVariants>["size"]>

function DialogTrigger({
  className,
  variant = "outline",
  size,
  tooltip,
  ...props
}: Omit<ComponentProps<typeof DialogTriggerPrimitive>, "aria-label"> & ButtonLookProps) {
  return (
    <ControlTooltip label={props["aria-label"]} tooltip={tooltip} iconOnly={size === "icon"}>
      <DialogTriggerPrimitive className={cnState(buttonVariants({ variant, size }), className)} {...props} />
    </ControlTooltip>
  )
}

function DialogBackdrop({ className, ...props }: ComponentProps<typeof DialogBackdropPrimitive>) {
  return <DialogBackdropPrimitive className={cnState(backdropClassName, className)} {...props} />
}

type DialogContentProps = ComponentProps<typeof DialogContentPrimitive> & {
  /** `sm` 24rem, `md` 32rem (default), `lg` 48rem, `xl` 72rem; `full` fills its container less `--floating-offset`. */
  size?: DialogSize
  /** On narrow screens it rises from the bottom as a full-width sheet; `false` keeps it centered. */
  sheet?: boolean
}

type FinalFocus = ComponentProps<typeof DialogContentPrimitive>["finalFocus"]

// Mounts before the content's children, so its layout effect runs before React's `autoFocus` inside them, and
// records the element to return to.
function FocusOpener({ memoryRef }: { memoryRef: RefObject<FocusMemory> }) {
  useRecordOpener(memoryRef)
  return null
}

// Mounts after the children: focus that moved between the two was taken by `autoFocus`, before UI SDK could
// record where it came from (UI SDK 0.1.0-beta.10 then returns focus past the opener, to the next control).
function FocusMoved({ memoryRef }: { memoryRef: RefObject<FocusMemory> }) {
  useRecordFocusMove(memoryRef)
  return null
}

function withFocusMarkers(content: ReactNode, memoryRef: RefObject<FocusMemory>) {
  return (
    <>
      <FocusOpener memoryRef={memoryRef} />
      {content}
      <FocusMoved memoryRef={memoryRef} />
    </>
  )
}

function assignRef(ref: Ref<HTMLElement> | undefined, element: HTMLElement | null) {
  if (typeof ref === "function") return ref(element)
  if (ref) ref.current = element
  return undefined
}

function resolveFocusTarget(target: Exclude<FinalFocus, "none">) {
  if (target === undefined || target === "trigger") return null
  if (typeof target === "function") return target()
  if (typeof target === "string") return document.querySelector<HTMLElement>(target)
  return target
}

/**
 * Keeps focus return working where UI SDK misses it: a React `autoFocus` field took focus before UI SDK recorded the
 * opener, or another modal (one of ours or another library's) opened while this one closes or unmounts, which keeps
 * focus. Pass the content's `finalFocus` and `ref`, give the content the returned `finalFocus` and `attach` (as its
 * ref), and wrap its children.
 */
function useFocusReturn(finalFocus: FinalFocus, forwarded?: Ref<HTMLElement>) {
  const memoryRef = useRef<FocusMemory>({ opener: null, movedBeforeOpen: false })
  const contentRef = useRef<HTMLElement | null>(null)
  const returnTo = () => {
    const { opener, movedBeforeOpen } = memoryRef.current
    return movedBeforeOpen && opener?.isConnected ? opener : null
  }
  // Returning the focused element leaves focus where it is; null sends UI SDK down its own fallback chain.
  const guarded = () => {
    if (!mayReturnFocus(contentRef.current)) return focusedElement() ?? (document.activeElement as HTMLElement | null)
    return finalFocus === undefined ? returnTo() : resolveFocusTarget(finalFocus as Exclude<FinalFocus, "none">)
  }
  function wrap<State>(children: ReactNode | ((state: State) => ReactNode)) {
    return typeof children === "function"
      ? (state: State) => withFocusMarkers(children(state), memoryRef)
      : withFocusMarkers(children, memoryRef)
  }
  const attach = useCallback(
    (element: HTMLElement | null) => {
      contentRef.current = element
      return assignRef(forwarded, element)
    },
    [forwarded],
  )
  return { finalFocus: finalFocus === "none" ? finalFocus : guarded, wrap, attach }
}

function DialogContent({
  className,
  size = "md",
  sheet = true,
  finalFocus,
  ref,
  children,
  ...props
}: DialogContentProps) {
  const { attach, finalFocus: returnFocus, wrap } = useFocusReturn(finalFocus, ref as Ref<HTMLElement> | undefined)
  return (
    <DialogContentPrimitive
      ref={attach}
      data-size={size}
      data-sheet={sheet ? "" : undefined}
      className={cnState(dialogContentVariants({ size, sheet }), className)}
      finalFocus={returnFocus}
      {...props}
    >
      {wrap(children)}
    </DialogContentPrimitive>
  )
}

function DialogHeader({ className, render, ...props }: PartProps<"div">) {
  return renderElement(
    "div",
    { "data-slot": "dialog-header", className: cn("flex shrink-0 flex-col gap-inline", className), ...props },
    render,
  )
}

/**
 * The part that scrolls, so the header and footer around it stay in view. It is positioned so the visually hidden
 * inputs inside Select, Checkbox and other controls are clipped by it, instead of overflowing the dialog and scrolling
 * the header away when a field takes focus. Its scroll area reaches past the content's padding to its edges; a content
 * without padding sets `data-dialog-flush`, and the body takes no padding of its own either.
 */
function DialogBody({ className, render, ...props }: PartProps<"div">) {
  return (
    <ScrollArea className="-mx-inset-surface flex min-h-0 min-w-0 flex-1 flex-col in-data-dialog-flush:mx-0">
      <ScrollAreaViewport
        render={(viewport) =>
          renderElement(
            "div",
            mergeProps(viewport, props, {
              "data-slot": "dialog-body",
              className: cn(
                "relative flex h-auto min-h-0 min-w-0 flex-1 flex-col gap-group overscroll-contain px-inset-surface in-data-dialog-flush:px-0",
                className,
              ),
            }),
            render,
          )
        }
      />
      <ScrollAreaScrollbar data-agent-hidden="" />
    </ScrollArea>
  )
}

function DialogFooter({ className, render, ...props }: PartProps<"div">) {
  return renderElement(
    "div",
    {
      "data-slot": "dialog-footer",
      className: cn("flex shrink-0 flex-col-reverse gap-items sm:flex-row sm:justify-end", className),
      ...props,
    },
    render,
  )
}

function DialogTitle({ className, ...props }: ComponentProps<typeof DialogTitlePrimitive>) {
  return <DialogTitlePrimitive className={cnState("text-title leading-none", className)} {...props} />
}

function DialogDescription({ className, ...props }: ComponentProps<typeof DialogDescriptionPrimitive>) {
  return <DialogDescriptionPrimitive className={cnState("text-sm text-muted-foreground", className)} {...props} />
}

function DialogClose({
  className,
  variant = "outline",
  size,
  tooltip,
  ...props
}: Omit<ComponentProps<typeof DialogClosePrimitive>, "aria-label"> & ButtonLookProps) {
  return (
    <ControlTooltip label={props["aria-label"]} tooltip={tooltip} iconOnly={size === "icon"}>
      <DialogClosePrimitive className={cnState(buttonVariants({ variant, size }), className)} {...props} />
    </ControlTooltip>
  )
}

export {
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
  backdropClassName,
  contentClassName,
  createDialogController,
  dialogContentVariants,
  useFocusReturn,
}
export type { DialogContentProps, DialogSize }
