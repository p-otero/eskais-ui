"use client"

import {
  Toast as ToastPrimitive,
  ToastAction as ToastActionPrimitive,
  ToastClose as ToastClosePrimitive,
  ToastDescription as ToastDescriptionPrimitive,
  ToastRegion as ToastRegionPrimitive,
  ToastTitle as ToastTitlePrimitive,
  createToaster,
  toast,
} from "@ui-sdk/react/toast"
import type { ToastType } from "@ui-sdk/react/toast"
import type { VariantProps } from "class-variance-authority"
import { useCallback } from "react"
import type { ComponentProps, Ref } from "react"
import {
  CircleCheckIcon,
  CircleExclamationPointIcon,
  InfoIcon,
  TriangleExclamationPointIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import type { Tone } from "@/lib/tone"
import { cn, cnState } from "@/lib/utils"

type ButtonLook = VariantProps<typeof buttonVariants>

// The region is a manual popover in the top layer, so the UA popover box (inset, margin, border, canvas) is reset.
// It takes no pointer events, so only the toasts cover the page beneath.
const toastRegionClassName =
  // oxlint-disable-next-line eskais/spacing-tokens -- the offset from the viewport edge pairs with w-[calc(100%-2rem)]
  "pointer-events-none fixed inset-auto z-toast m-4 w-[calc(100%-2rem)] max-w-88 overflow-visible border-0 bg-transparent p-0 data-[side=bottom]:bottom-0 data-[side=top]:top-0 data-[align=end]:end-0 data-[align=start]:start-0 data-[align=center]:left-1/2 data-[align=center]:mx-0 data-[align=center]:-translate-x-1/2 [&>[data-slot=toast-list]]:m-0 [&>[data-slot=toast-list]]:flex [&>[data-slot=toast-list]]:list-none [&>[data-slot=toast-list]]:flex-col [&>[data-slot=toast-list]]:gap-items [&>[data-slot=toast-list]]:p-0 data-[side=bottom]:[&>[data-slot=toast-list]]:flex-col-reverse"

const toastClassName =
  // oxlint-disable-next-line shadcn/no-arbitrary-values -- with an icon, the description starts under the title: the size-4 icon plus the gap-items column gap
  "has-[>[data-slot=toast-icon]]:[&>[data-slot=toast-description]]:ps-[calc(--spacing(4)+var(--gap-items))] pointer-events-auto flex flex-wrap items-center gap-x-items gap-y-inline surface-floating px-inset-surface py-group text-sm outline-none select-none translate-x-(--toast-swipe-x) translate-y-(--toast-swipe-y) transition duration-panel ease-standard focus-visible:ring-2 focus-visible:ring-ring data-swiping:transition-none data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:transition-opacity motion-reduce:data-starting-style:scale-100"

type ToastRegionProps = ComponentProps<typeof ToastRegionPrimitive> & {
  /** How long the pointer has to rest on the toasts, in ms, before their timers pause. Focus pauses them at once. */
  hoverDelay?: number
}

// UI SDK pauses the timers on the region's first pointerenter, so a pointer passing over on its way to the page would
// hold the toasts. A capture listener on the region runs before UI SDK's own one: it holds the enter back and replays
// it once the pointer has rested, and drops the matching leave when the enter never got through. Enter and leave don't
// bubble, but a toast's own pass through the region's capture phase, so only the region's are handled.
function delayHover(region: HTMLElement, delay: number) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let entered = false
  let replaying = false
  const enter = (event: PointerEvent) => {
    if (replaying || event.target !== region || event.pointerType === "touch") return
    event.stopImmediatePropagation()
    clearTimeout(timer)
    timer = setTimeout(() => {
      entered = true
      replaying = true
      region.dispatchEvent(new PointerEvent("pointerenter", { pointerType: event.pointerType }))
      replaying = false
    }, delay)
  }
  const leave = (event: PointerEvent) => {
    if (event.target !== region || event.pointerType === "touch") return
    clearTimeout(timer)
    if (!entered) event.stopImmediatePropagation()
    entered = false
  }
  region.addEventListener("pointerenter", enter, { capture: true })
  region.addEventListener("pointerleave", leave, { capture: true })
  return () => {
    clearTimeout(timer)
    region.removeEventListener("pointerenter", enter, { capture: true })
    region.removeEventListener("pointerleave", leave, { capture: true })
  }
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") return ref(value)
  if (ref) ref.current = value
}

function ToastRegion({ className, hoverDelay = 300, ref, ...props }: ToastRegionProps) {
  const regionRef = useCallback(
    (node: HTMLElement | null) => {
      const cleanup = assignRef(ref, node)
      const stopDelaying = node ? delayHover(node, hoverDelay) : undefined
      return () => {
        stopDelaying?.()
        if (typeof cleanup === "function") cleanup()
        else assignRef(ref, null)
      }
    },
    [hoverDelay, ref],
  )
  return <ToastRegionPrimitive ref={regionRef} className={cnState(toastRegionClassName, className)} {...props} />
}

const toastTypeTones = {
  default: "neutral",
  loading: "neutral",
  info: "info",
  success: "success",
  warning: "warning",
  error: "destructive",
} satisfies Record<ToastType, Tone>

/** The tone a toast's UI SDK type (`toast.error`, `toast.success`…) maps to. */
function toastTone(type: ToastType): Tone {
  return toastTypeTones[type]
}

type ToastProps = ComponentProps<typeof ToastPrimitive> & {
  /** What the toast means. Defaults to the tone of its type, so `toast.error()` reads as destructive. */
  tone?: Tone
}

const toastToneClassNames = {
  neutral: "",
  info: "border-info-border",
  success: "border-success-border",
  warning: "border-warning-border",
  destructive: "border-destructive-border",
  violet: "border-violet-border",
} satisfies Record<Tone, string>

// The type is only known from the part's state, so the tone's classes come from a class-name function.
function Toast({ className, tone, ...props }: ToastProps) {
  return (
    <ToastPrimitive
      className={(state) =>
        cn(
          toastClassName,
          toastToneClassNames[tone ?? toastTone(state.type)],
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function ToastTitle({ className, ...props }: ComponentProps<typeof ToastTitlePrimitive>) {
  return <ToastTitlePrimitive className={cnState("min-w-0 flex-1 font-medium", className)} {...props} />
}

function ToastDescription({ className, ...props }: ComponentProps<typeof ToastDescriptionPrimitive>) {
  return (
    <ToastDescriptionPrimitive className={cnState("order-1 basis-full text-muted-foreground", className)} {...props} />
  )
}

function ToastAction({
  className,
  variant = "default",
  size = "sm",
  ...props
}: ComponentProps<typeof ToastActionPrimitive> & ButtonLook) {
  return <ToastActionPrimitive className={cnState(buttonVariants({ variant, size }), className)} {...props} />
}

function ToastClose({
  className,
  variant = "ghost",
  size = "sm",
  ...props
}: ComponentProps<typeof ToastClosePrimitive> & ButtonLook) {
  return <ToastClosePrimitive className={cnState(buttonVariants({ variant, size }), className)} {...props} />
}

const toneIcons = {
  info: InfoIcon,
  success: CircleCheckIcon,
  warning: TriangleExclamationPointIcon,
  destructive: CircleExclamationPointIcon,
} satisfies Partial<Record<Tone, LucideIcon>>

const toneIconClassNames = {
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
} satisfies Record<keyof typeof toneIcons, string>

type ToastIconProps = Omit<ComponentProps<"span">, "children"> & {
  /** The toast's type: `loading` shows a spinner, and the others the icon of their tone. */
  type?: ToastType
  /** Overrides the tone of the type. `neutral` and `violet` have no icon. */
  tone?: Tone
}

/** A decorative mark in the tone's colour. The toast's text still says what happened. */
function ToastIcon({ type = "default", tone, className, ...props }: ToastIconProps) {
  const resolved = tone ?? toastTone(type)
  const loading = type === "loading" && tone === undefined
  if (!loading && !(resolved in toneIcons)) return null
  const key = resolved as keyof typeof toneIcons
  const Icon = toneIcons[key]
  return (
    <span
      data-slot="toast-icon"
      data-tone={loading ? "loading" : resolved}
      aria-hidden="true"
      className={cn("flex shrink-0", loading ? "text-muted-foreground" : toneIconClassNames[key], className)}
      {...props}
    >
      {loading ? <Spinner size="md" /> : <Icon className="size-4" />}
    </span>
  )
}

type ToastStackLabels = {
  /** The accessible name of each toast's close button. */
  close: string
}

const toastStackLabels: ToastStackLabels = { close: "Dismiss" }

type ToastStackProps = Omit<ToastRegionProps, "children"> & {
  /** Accessible names, in the page's language. */
  labels?: Partial<ToastStackLabels>
  /** @deprecated Use `labels.close`. */
  closeLabel?: string
}

// data-agent-hidden by default: an empty region has no name, which leaves agents an unnamed entry.
function ToastStack({ labels, closeLabel, ...props }: ToastStackProps) {
  const close = labels?.close ?? closeLabel ?? toastStackLabels.close
  return (
    <ToastRegion data-agent-hidden {...props}>
      {(item) => (
        <Toast>
          <ToastIcon type={item.type} />
          <ToastTitle />
          <ToastDescription />
          <ToastAction />
          {item.cancel ? (
            <ToastClose variant="outline" action={item.cancel.onCancel}>
              {item.cancel.label}
            </ToastClose>
          ) : (
            item.dismissible !== false && (
              <ToastClose aria-label={close} className="size-control-sm px-0">
                <XIcon />
              </ToastClose>
            )
          )}
        </Toast>
      )}
    </ToastRegion>
  )
}

export {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastIcon,
  ToastRegion,
  ToastStack,
  ToastTitle,
  createToaster,
  toast,
  toastTone,
}
export type { ToastIconProps, ToastProps, ToastRegionProps, ToastStackLabels, ToastStackProps }
