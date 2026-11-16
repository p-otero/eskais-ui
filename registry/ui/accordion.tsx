"use client"

import {
  Accordion as AccordionPrimitive,
  AccordionHeader as AccordionHeaderPrimitive,
  AccordionItem as AccordionItemPrimitive,
  AccordionPanel as AccordionPanelPrimitive,
  AccordionTrigger as AccordionTriggerPrimitive,
  createAccordionController,
} from "@ui-sdk/react/accordion"
import type { ComponentProps } from "react"

import { cnState } from "@/lib/utils"

function Accordion({ className, ...props }: ComponentProps<typeof AccordionPrimitive>) {
  return <AccordionPrimitive className={cnState("flex w-full flex-col", className)} {...props} />
}

function AccordionItem({ className, ...props }: ComponentProps<typeof AccordionItemPrimitive>) {
  return <AccordionItemPrimitive className={cnState("border-b last:border-b-0", className)} {...props} />
}

function AccordionHeader({ className, ...props }: ComponentProps<typeof AccordionHeaderPrimitive>) {
  return <AccordionHeaderPrimitive className={cnState("m-0 flex text-sm font-medium", className)} {...props} />
}

function AccordionTrigger({ className, children, ...props }: ComponentProps<typeof AccordionTriggerPrimitive>) {
  return (
    <AccordionTriggerPrimitive
      className={cnState(
        "group/accordion-trigger flex min-h-control flex-1 cursor-pointer items-center justify-between gap-inline rounded-control py-inset-item text-start font-medium transition-colors outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-disabled:cursor-not-allowed data-disabled:opacity-50 data-disabled:hover:no-underline [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    >
      {(state) => (
        <>
          {typeof children === "function" ? children(state) : children}
          <svg
            data-slot="accordion-icon"
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted-foreground transition-transform duration-panel ease-standard group-data-open/accordion-trigger:rotate-180 motion-reduce:transition-none"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </>
      )}
    </AccordionTriggerPrimitive>
  )
}

// Overflow is clipped only while the height animates, so focus rings inside an open panel stay visible.
function AccordionPanel({ className, children, ...props }: ComponentProps<typeof AccordionPanelPrimitive>) {
  return (
    <AccordionPanelPrimitive
      className={cnState(
        "h-(--accordion-panel-height) text-sm transition-all duration-panel ease-standard data-ending-style:h-0 data-ending-style:overflow-hidden data-starting-style:h-0 data-starting-style:overflow-hidden motion-reduce:transition-none",
        className,
      )}
      {...props}
    >
      {(state) => <div className="pb-group">{typeof children === "function" ? children(state) : children}</div>}
    </AccordionPanelPrimitive>
  )
}

export { Accordion, AccordionHeader, AccordionItem, AccordionPanel, AccordionTrigger, createAccordionController }
