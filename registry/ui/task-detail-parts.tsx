"use client"

import type { ReactNode } from "react"

import { formatQuantity, type Quantity, type QuantityLabels } from "@/lib/quantity"
import { QuantityValue } from "@/components/ui/quantity-value"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { usageFormatter } from "@/components/ui/usage"

type DetailValueProps = {
  term: string
  children?: ReactNode
  /** Shown instead of `children`; an estimate or a sourced value gets a tooltip saying so. */
  quantity?: Quantity
  locale?: string
  formatCurrency?: (usd: number) => string
  quantityLabels?: Partial<QuantityLabels>
}

function DetailValue({ term, children, quantity, locale, formatCurrency, quantityLabels }: DetailValueProps) {
  let value = children
  if (quantity) {
    const format = usageFormatter("cost", { locale, formatCurrency })
    const hint = formatQuantity(quantity, {
      format,
      locale,
      labels: quantityLabels,
    }).title
    const shown = (
      <QuantityValue value={quantity} format={format} locale={locale} labels={quantityLabels} title={undefined} />
    )
    value = hint ? (
      <Tooltip>
        <TooltipTrigger
          aria-label={`${term}: ${formatQuantity(quantity, { format, locale, labels: quantityLabels }).srText}`}
          className="cursor-help rounded-control underline decoration-dotted underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {shown}
        </TooltipTrigger>
        <TooltipContent>{hint}</TooltipContent>
      </Tooltip>
    ) : (
      shown
    )
  }
  return (
    <div data-slot="task-detail-value" className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{term}</dt>
      <dd className="min-w-0 truncate">{value}</dd>
    </div>
  )
}

// Escape inside a popup the panel holds (a reject confirmation, a tooltip) belongs to that popup.
function insidePopup(target: EventTarget, panel: Element) {
  const popup = target instanceof Element ? target.closest('[role="dialog"],[role="alertdialog"],[popover]') : null
  return popup !== null && popup !== panel && panel.contains(popup)
}

function Block({ title, level, children }: { title: string; level: number; children: ReactNode }) {
  const Heading = `h${Math.min(level, 6)}` as "h3"
  return (
    <section className="flex flex-col gap-2">
      <Heading className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</Heading>
      {children}
    </section>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

export { Block, CloseIcon, DetailValue, insidePopup }
export type { DetailValueProps }
