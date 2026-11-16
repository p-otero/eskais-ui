"use client"

import { Meter, MeterTrack } from "@ui-sdk/react/meter"
import { renderElement, type PartProps } from "@ui-sdk/react/primitive"
import type { ComponentProps, ReactNode } from "react"

import { Collapsible, CollapsibleIcon, CollapsiblePanel, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

type AcceptanceResult = "pass" | "fail" | "unverified"

interface AcceptanceCriterion {
  id?: string
  text: string
  result: AcceptanceResult
  evidence?: ReactNode
}

type AcceptanceCounts = Record<AcceptanceResult, number>

interface AcceptanceLabels extends Record<AcceptanceResult, string> {
  bar: string
}

const defaultAcceptanceLabels: AcceptanceLabels = {
  pass: "Passed",
  fail: "Failed",
  unverified: "Not verified",
  bar: "Acceptance criteria",
}

const results: AcceptanceResult[] = ["pass", "fail", "unverified"]

const resultColor: Record<AcceptanceResult, string> = {
  pass: "text-success",
  fail: "text-destructive",
  unverified: "text-muted-foreground",
}

const segmentColor: Record<AcceptanceResult, string> = {
  pass: "bg-success",
  fail: "bg-destructive",
  unverified: "bg-muted-foreground",
}

const iconPaths: Record<AcceptanceResult, ReactNode> = {
  pass: <path d="m5 12 5 5L20 7" />,
  fail: <path d="M18 6 6 18M6 6l12 12" />,
  unverified: <circle cx="12" cy="12" r="8" strokeDasharray="3 3" />,
}

function countAcceptance(criteria: readonly Pick<AcceptanceCriterion, "result">[]): AcceptanceCounts {
  const counts: AcceptanceCounts = { pass: 0, fail: 0, unverified: 0 }
  for (const { result } of criteria) counts[result]++
  return counts
}

function formatAcceptanceSummary({ pass, fail, unverified }: AcceptanceCounts) {
  const summary = `${pass} of ${pass + fail + unverified} passed`
  return fail > 0 ? `${summary}, ${fail} failed` : summary
}

function AcceptanceIcon({ result }: { result: AcceptanceResult }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-lh w-4 shrink-0", resultColor[result])}
    >
      {iconPaths[result]}
    </svg>
  )
}

type AcceptanceListProps = Omit<PartProps<"ul">, "children"> & {
  criteria: readonly AcceptanceCriterion[]
  labels?: Partial<AcceptanceLabels>
  /** `"disclosure"` keeps each criterion to one row and reveals its evidence on demand. */
  evidence?: "inline" | "disclosure"
}

function AcceptanceList({
  criteria,
  labels,
  evidence: evidenceMode = "inline",
  className,
  render,
  ...props
}: AcceptanceListProps) {
  const text = { ...defaultAcceptanceLabels, ...labels }
  return renderElement(
    "ul",
    {
      "data-slot": "acceptance-list",
      // Preflight's list-style: none strips list semantics in Safari unless the role is explicit.
      role: "list",
      className: cn("flex flex-col gap-items text-sm", className),
      ...props,
      children: criteria.map((criterion) => (
        <li
          key={criterion.id ?? criterion.text}
          data-slot="acceptance-item"
          data-result={criterion.result}
          className="flex gap-inline"
        >
          <AcceptanceIcon result={criterion.result} />
          {criterion.evidence && evidenceMode === "disclosure" ? (
            <Collapsible className="min-w-0 flex-1">
              <CollapsibleTrigger className="min-h-0 w-full justify-between rounded-sm px-0 text-start font-normal hover:bg-transparent hover:text-foreground hover:underline">
                <span className="min-w-0">
                  <span className="sr-only">{text[criterion.result]}</span>
                  {criterion.text}
                </span>
                <CollapsibleIcon className="text-muted-foreground" />
              </CollapsibleTrigger>
              <CollapsiblePanel>
                <p data-slot="acceptance-evidence" className="pt-inline text-xs text-muted-foreground">
                  {criterion.evidence}
                </p>
              </CollapsiblePanel>
            </Collapsible>
          ) : (
            <div className="flex min-w-0 flex-col gap-inline">
              <span className="sr-only">{text[criterion.result]}</span>
              <span>{criterion.text}</span>
              {criterion.evidence ? (
                <span data-slot="acceptance-evidence" className="text-xs text-muted-foreground">
                  {criterion.evidence}
                </span>
              ) : null}
            </div>
          )}
        </li>
      )),
    },
    render,
  )
}

type AcceptanceBarProps = Omit<ComponentProps<typeof Meter>, "value" | "max" | "min" | "children"> & {
  counts: AcceptanceCounts
  labels?: Partial<Pick<AcceptanceLabels, "bar">>
  formatSummary?: (counts: AcceptanceCounts) => string
}

function AcceptanceBar({
  counts,
  labels,
  formatSummary = formatAcceptanceSummary,
  className,
  ...props
}: AcceptanceBarProps) {
  const total = counts.pass + counts.fail + counts.unverified
  return (
    <Meter
      value={counts.pass}
      max={Math.max(total, 1)}
      aria-label={labels?.bar ?? defaultAcceptanceLabels.bar}
      getValueLabel={() => formatSummary(counts)}
      className={cn("w-full", className)}
      {...props}
    >
      <MeterTrack className="flex h-2 w-full gap-px overflow-hidden rounded-control bg-muted">
        {results.map((result) =>
          counts[result] > 0 ? (
            <div
              key={result}
              data-slot="acceptance-segment"
              data-result={result}
              className={cn("h-full basis-0", segmentColor[result])}
              style={{ flexGrow: counts[result] }}
            />
          ) : null,
        )}
      </MeterTrack>
    </Meter>
  )
}

export { AcceptanceBar, AcceptanceList, countAcceptance, defaultAcceptanceLabels, formatAcceptanceSummary }
export type {
  AcceptanceBarProps,
  AcceptanceCounts,
  AcceptanceCriterion,
  AcceptanceLabels,
  AcceptanceListProps,
  AcceptanceResult,
}
