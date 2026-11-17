"use client"

import {
  Carousel as CarouselPrimitive,
  CarouselContent as CarouselContentPrimitive,
  CarouselIndicator as CarouselIndicatorPrimitive,
  CarouselIndicatorGroup as CarouselIndicatorGroupPrimitive,
  CarouselItem as CarouselItemPrimitive,
  CarouselNext as CarouselNextPrimitive,
  CarouselPlayToggle as CarouselPlayTogglePrimitive,
  CarouselPrevious as CarouselPreviousPrimitive,
  CarouselViewport as CarouselViewportPrimitive,
  createCarouselController,
  type CarouselState,
} from "@ui-sdk/react/carousel"
import { createContext, useContext, useMemo, useState, type ComponentProps, type ReactNode } from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn, cnState } from "@/lib/utils"

const stepClassName = buttonVariants({ variant: "outline", size: "icon" })

const CarouselStateContext = createContext<CarouselState | null>(null)

function CarouselStateProvider({ state, children }: { state: CarouselState; children: ReactNode }) {
  const { page, pageCount, playing, orientation } = state
  const value = useMemo(() => ({ page, pageCount, playing, orientation }), [page, pageCount, playing, orientation])
  return <CarouselStateContext value={value}>{children}</CarouselStateContext>
}

/** A region of slides that scroll a page at a time; the parts inside read its page through `useCarouselState`. */
function Carousel({ className, children, ...props }: ComponentProps<typeof CarouselPrimitive>) {
  return (
    <CarouselPrimitive className={cnState("relative flex flex-col gap-group", className)} {...props}>
      {(state) => (
        <CarouselStateProvider state={state}>
          {typeof children === "function" ? children(state) : children}
        </CarouselStateProvider>
      )}
    </CarouselPrimitive>
  )
}

/**
 * The carousel's state, read from UI SDK inside a `Carousel`: `page` (from 1), `pageCount` (null until the slides are
 * measured, as on the server), `playing` and `orientation`.
 */
function useCarouselState() {
  const state = useContext(CarouselStateContext)
  if (!state) throw new Error("useCarouselState must be inside a Carousel.")
  return state
}

type CarouselLabels = {
  /** The position, shown and announced: "2 of 3". */
  status: (page: number, pageCount: number) => string
}

const defaultCarouselLabels: CarouselLabels = { status: (page, pageCount) => `${String(page)} of ${String(pageCount)}` }

type CarouselStatusProps = Omit<ComponentProps<"p">, "children"> & {
  labels?: Partial<CarouselLabels>
}

/**
 * The current page and the page count, like "1 of 3". Screen readers hear it politely when the page changes, never
 * on load or while the carousel rotates; the slides already say their own position.
 */
function CarouselStatus({ className, labels, ...props }: CarouselStatusProps) {
  const { page, pageCount, playing } = useCarouselState()
  const status = labels?.status ?? defaultCarouselLabels.status
  const text = pageCount === null ? "" : status(page, pageCount)
  const [shownPage, setShownPage] = useState(page)
  const [announcement, setAnnouncement] = useState("")
  if (page !== shownPage) {
    setShownPage(page)
    setAnnouncement(text)
  }
  return (
    <p
      data-slot="carousel-status"
      className={cn("text-body-sm text-muted-foreground tabular-nums", className)}
      {...props}
    >
      <span aria-hidden="true">{text}</span>
      <span className="sr-only" aria-live={playing ? "off" : "polite"} aria-atomic="true">
        {announcement}
      </span>
    </p>
  )
}

function CarouselViewport({ className, ...props }: ComponentProps<typeof CarouselViewportPrimitive>) {
  return (
    <CarouselViewportPrimitive
      className={cnState(
        "min-w-0 flex-1 rounded-surface outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-dragging:cursor-grabbing",
        className,
      )}
      {...props}
    />
  )
}

function CarouselContent({ className, ...props }: ComponentProps<typeof CarouselContentPrimitive>) {
  return (
    <CarouselContentPrimitive
      className={cnState("flex gap-section data-[orientation=vertical]:flex-col", className)}
      {...props}
    />
  )
}

function CarouselItem({ className, ...props }: ComponentProps<typeof CarouselItemPrimitive>) {
  return <CarouselItemPrimitive className={cnState("min-w-0 basis-full", className)} {...props} />
}

function CarouselPrevious({
  className,
  children,
  "aria-label": label = "Previous slide",
  ...props
}: ComponentProps<typeof CarouselPreviousPrimitive>) {
  return (
    <CarouselPreviousPrimitive aria-label={label} className={cnState(stepClassName, className)} {...props}>
      {children ?? (
        <ChevronLeftIcon className="in-data-[orientation=horizontal]:rtl:rotate-180 in-data-[orientation=vertical]:rotate-90" />
      )}
    </CarouselPreviousPrimitive>
  )
}

function CarouselNext({
  className,
  children,
  "aria-label": label = "Next slide",
  ...props
}: ComponentProps<typeof CarouselNextPrimitive>) {
  return (
    <CarouselNextPrimitive aria-label={label} className={cnState(stepClassName, className)} {...props}>
      {children ?? (
        <ChevronRightIcon className="in-data-[orientation=horizontal]:rtl:rotate-180 in-data-[orientation=vertical]:rotate-90" />
      )}
    </CarouselNextPrimitive>
  )
}

function CarouselIndicatorGroup({ className, ...props }: ComponentProps<typeof CarouselIndicatorGroupPrimitive>) {
  return (
    <CarouselIndicatorGroupPrimitive
      className={cnState("flex items-center justify-center gap-inline", className)}
      {...props}
    />
  )
}

type CarouselIndicatorProps = ComponentProps<typeof CarouselIndicatorPrimitive> & {
  label?: (page: number) => string
}

const slideLabel = (page: number) => `Slide ${page}`

function CarouselIndicator({ className, page, label = slideLabel, ...props }: CarouselIndicatorProps) {
  return (
    <CarouselIndicatorPrimitive
      page={page}
      aria-label={page === undefined ? undefined : label(page)}
      className={cnState(
        "group/indicator inline-flex size-control-sm cursor-pointer items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className="size-2 rounded-full bg-input-strong transition-colors group-data-selected/indicator:bg-primary"
      />
    </CarouselIndicatorPrimitive>
  )
}

function CarouselPlayToggle({ className, ...props }: ComponentProps<typeof CarouselPlayTogglePrimitive>) {
  return <CarouselPlayTogglePrimitive className={cnState(stepClassName, className)} {...props} />
}

export {
  Carousel,
  CarouselContent,
  CarouselIndicator,
  CarouselIndicatorGroup,
  CarouselItem,
  CarouselNext,
  CarouselPlayToggle,
  CarouselPrevious,
  CarouselStatus,
  CarouselViewport,
  createCarouselController,
  useCarouselState,
}
export type { CarouselIndicatorProps, CarouselLabels, CarouselStatusProps }
export type { CarouselController, CarouselOrientation, CarouselState } from "@ui-sdk/react/carousel"
