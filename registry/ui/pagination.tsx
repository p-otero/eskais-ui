"use client"

import {
  Pagination as PaginationPrimitive,
  PaginationEllipsis as PaginationEllipsisPrimitive,
  PaginationFirst as PaginationFirstPrimitive,
  PaginationItem,
  PaginationLast as PaginationLastPrimitive,
  PaginationLink as PaginationLinkPrimitive,
  PaginationList as PaginationListPrimitive,
  PaginationNext as PaginationNextPrimitive,
  PaginationPrevious as PaginationPreviousPrimitive,
  createPaginationController,
  paginationRange,
} from "@ui-sdk/react/pagination"
import type { ComponentProps } from "react"

import { buttonVariants } from "@/components/ui/button"
import { cnState } from "@/lib/utils"

type PaginationLabels = {
  navigation: string
  previous: string
  next: string
  page: (page: number) => string
}

const defaultPaginationLabels: PaginationLabels = {
  navigation: "Pagination",
  previous: "Previous page",
  next: "Next page",
  page: (page) => `Page ${page}`,
}

const stepClassName = `${buttonVariants({ variant: "ghost", size: "icon" })} data-disabled:cursor-not-allowed data-disabled:opacity-50 data-disabled:hover:bg-transparent rtl:[&_svg]:-scale-x-100`

function Chevron({ direction }: { direction: "previous" | "next" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d={direction === "previous" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
    </svg>
  )
}

type PaginationProps = ComponentProps<typeof PaginationPrimitive> & { labels?: Partial<PaginationLabels> }

function Pagination({ className, labels, children, "aria-label": ariaLabel, ...props }: PaginationProps) {
  const text = { ...defaultPaginationLabels, ...labels }
  return (
    <PaginationPrimitive
      aria-label={ariaLabel ?? text.navigation}
      className={cnState("flex w-full justify-center", className)}
      {...props}
    >
      {children ?? (
        <PaginationList>
          {({ items }) => (
            <>
              <PaginationItem>
                <PaginationPrevious aria-label={text.previous} />
              </PaginationItem>
              {items.map((item) => (
                <PaginationItem key={item}>
                  {typeof item === "number" ? (
                    <PaginationLink page={item} aria-label={text.page(item)} />
                  ) : (
                    <PaginationEllipsis />
                  )}
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext aria-label={text.next} />
              </PaginationItem>
            </>
          )}
        </PaginationList>
      )}
    </PaginationPrimitive>
  )
}

function PaginationList({ className, ...props }: ComponentProps<typeof PaginationListPrimitive>) {
  return (
    <PaginationListPrimitive
      className={cnState("m-0 flex list-none flex-row flex-wrap items-center gap-inline p-0", className)}
      {...props}
    />
  )
}

function PaginationLink({ className, ...props }: ComponentProps<typeof PaginationLinkPrimitive>) {
  return (
    <PaginationLinkPrimitive
      className={cnState(
        `${buttonVariants({ variant: "ghost", size: "icon" })} tabular-nums data-current:border data-current:border-input data-current:bg-background/(--glass-opacity)`,
        className,
      )}
      {...props}
    />
  )
}

function PaginationPrevious({ className, children, ...props }: ComponentProps<typeof PaginationPreviousPrimitive>) {
  return (
    <PaginationPreviousPrimitive className={cnState(stepClassName, className)} {...props}>
      {children ?? <Chevron direction="previous" />}
    </PaginationPreviousPrimitive>
  )
}

function PaginationNext({ className, children, ...props }: ComponentProps<typeof PaginationNextPrimitive>) {
  return (
    <PaginationNextPrimitive className={cnState(stepClassName, className)} {...props}>
      {children ?? <Chevron direction="next" />}
    </PaginationNextPrimitive>
  )
}

function PaginationFirst({ className, ...props }: ComponentProps<typeof PaginationFirstPrimitive>) {
  return <PaginationFirstPrimitive className={cnState(stepClassName, className)} {...props} />
}

function PaginationLast({ className, ...props }: ComponentProps<typeof PaginationLastPrimitive>) {
  return <PaginationLastPrimitive className={cnState(stepClassName, className)} {...props} />
}

function PaginationEllipsis({ className, ...props }: ComponentProps<typeof PaginationEllipsisPrimitive>) {
  return (
    <PaginationEllipsisPrimitive
      className={cnState("inline-flex size-control items-center justify-center text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Pagination,
  PaginationEllipsis,
  PaginationFirst,
  PaginationItem,
  PaginationLast,
  PaginationLink,
  PaginationList,
  PaginationNext,
  PaginationPrevious,
  createPaginationController,
  defaultPaginationLabels,
  paginationRange,
}
export type { PaginationLabels, PaginationProps }
