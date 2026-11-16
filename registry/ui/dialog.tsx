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
import { renderElement, type PartProps } from "@ui-sdk/react/primitive"
import { cva, type VariantProps } from "class-variance-authority"
import {
  useCallback,
  useLayoutEffect,
  useRef,
  type ComponentProps,
  type ReactNode,
  type Ref,
  type RefObject,
} from "react"

import { buttonVariants } from "@/components/ui/button"
import { cn, cnState } from "@/lib/utils"

type ButtonLook = VariantProps<typeof buttonVariants>

// While they animate out, the backdrop and content let presses through, so the first click on the page counts.
const backdropClassName =
  "fixed inset-0 z-overlay bg-overlay transition-opacity duration-dialog ease-standard data-ending-style:pointer-events-none data-ending-style:opacity-0 data-starting-style:opacity-0"

// Sizes and offsets come from the containing block (the viewport for a top-layer dialog) through %, never viewport units.
const dialogContentVariants = cva(
  [
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
  ...props
}: ComponentProps<typeof DialogTriggerPrimitive> & ButtonLook) {
  return <DialogTriggerPrimitive className={cnState(buttonVariants({ variant, size }), className)} {...props} />
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

type FocusMemory = { opener: HTMLElement | null; movedBeforeOpen: boolean; content?: HTMLElement | null }
type FinalFocus = ComponentProps<typeof DialogContentPrimitive>["finalFocus"]

function focusedElement() {
  const active = document.activeElement
  return active instanceof HTMLElement && active !== document.body ? active : null
}

function openModals() {
  const modals = [...document.querySelectorAll('[aria-modal="true"]')]
  try {
    modals.push(...document.querySelectorAll("dialog:modal"))
  } catch {
    // Engines without :modal (jsdom) still see modals by aria-modal.
  }
  return modals.filter((modal) => !modal.hasAttribute("data-ending-style"))
}

// A closing dialog gives focus back only from inside itself, or from <body> when no other modal is open. Another
// modal opened meanwhile (one of ours or another library's, which may move focus in a frame later) keeps it.
function mayReturnFocus(own: Element | null, active: Element | null = focusedElement()) {
  if (active) return own?.contains(active) ?? false
  return !openModals().some((modal) => modal !== own && !own?.contains(modal))
}

// Mounts before the content's children, so its layout effect runs before React's `autoFocus` inside them, and
// records the element to return to. Unmounted with focus still inside (the dialog itself left the page while
// open), it gives focus back to that element instead of letting it fall to <body>.
function FocusOpener({ memoryRef, restore }: { memoryRef: RefObject<FocusMemory>; restore: boolean }) {
  const recorded = useRef(false)
  useLayoutEffect(() => {
    if (!recorded.current) {
      recorded.current = true
      memoryRef.current = { ...memoryRef.current, opener: focusedElement(), movedBeforeOpen: false }
    }
    return () => {
      const inside = document.activeElement
      const { opener } = memoryRef.current
      queueMicrotask(() => {
        if (!restore || !opener?.isConnected || inside?.isConnected || !mayReturnFocus(null)) return
        opener.focus({ preventScroll: true })
      })
    }
  }, [memoryRef, restore])
  return null
}

// Mounts after the children: focus that moved between the two was taken by `autoFocus`, before UI SDK could
// record where it came from.
function FocusMoved({ memoryRef }: { memoryRef: RefObject<FocusMemory> }) {
  const checked = useRef(false)
  useLayoutEffect(() => {
    if (checked.current) return
    checked.current = true
    memoryRef.current = { ...memoryRef.current, movedBeforeOpen: focusedElement() !== memoryRef.current.opener }
  }, [memoryRef])
  return null
}

function withFocusMarkers(content: ReactNode, memoryRef: RefObject<FocusMemory>, restore: boolean) {
  return (
    <>
      <FocusOpener memoryRef={memoryRef} restore={restore} />
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
 * Keeps focus return working when UI SDK can't see the opener: the content unmounts while open
 * (`{open && <Dialog open />}`), or a React `autoFocus` field took focus first. It never takes focus from another
 * modal opened while this one closes. Pass the content's `finalFocus` and `ref`, give the content the returned
 * `finalFocus` and `attach` (as its ref), and wrap its children.
 */
function useFocusReturn(finalFocus: FinalFocus, forwarded?: Ref<HTMLElement>) {
  const memoryRef = useRef<FocusMemory>({ opener: null, movedBeforeOpen: false })
  const restore = finalFocus !== "none"
  const returnTo = () => {
    const { opener, movedBeforeOpen } = memoryRef.current
    return movedBeforeOpen && opener?.isConnected ? opener : null
  }
  // Returning the focused element leaves focus where it is; null would send UI SDK down its fallback chain.
  const guarded = () => {
    if (!mayReturnFocus(memoryRef.current.content ?? null))
      return focusedElement() ?? (document.activeElement as HTMLElement | null)
    return finalFocus === undefined ? returnTo() : resolveFocusTarget(finalFocus as Exclude<FinalFocus, "none">)
  }
  function wrap<State>(children: ReactNode | ((state: State) => ReactNode)) {
    return typeof children === "function"
      ? (state: State) => withFocusMarkers(children(state), memoryRef, restore)
      : withFocusMarkers(children, memoryRef, restore)
  }
  const attach = useCallback(
    (element: HTMLElement | null) => {
      memoryRef.current.content = element
      return assignRef(forwarded, element)
    },
    [forwarded],
  )
  return { finalFocus: restore ? guarded : finalFocus, wrap, attach }
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
  const focus = useFocusReturn(finalFocus, ref as Ref<HTMLElement> | undefined)
  return (
    <DialogContentPrimitive
      ref={focus.attach}
      data-size={size}
      data-sheet={sheet ? "" : undefined}
      className={cnState(dialogContentVariants({ size, sheet }), className)}
      // oxlint-disable-next-line react/refs -- read when UI SDK calls finalFocus on close, never during render
      finalFocus={focus.finalFocus}
      {...props}
    >
      {focus.wrap(children)}
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
 * the header away when a field takes focus.
 */
function DialogBody({ className, render, ...props }: PartProps<"div">) {
  return renderElement(
    "div",
    {
      "data-slot": "dialog-body",
      className: cn(
        "relative -mx-inset-surface flex min-h-0 min-w-0 flex-1 flex-col gap-group overflow-y-auto overscroll-contain px-inset-surface",
        className,
      ),
      ...props,
    },
    render,
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
  ...props
}: ComponentProps<typeof DialogClosePrimitive> & ButtonLook) {
  return <DialogClosePrimitive className={cnState(buttonVariants({ variant, size }), className)} {...props} />
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
