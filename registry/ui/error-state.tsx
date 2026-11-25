"use client"

import type { ComponentProps, ReactNode } from "react"
import { CircleExclamationPointIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleIcon, CollapsiblePanel, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  type EmptySize,
} from "@/components/ui/empty"
import { cn } from "@/lib/utils"

type RetryProps =
  | {
      /** Runs again what failed. A returned Promise keeps the button pending until it settles. */
      onRetry: () => unknown
      retryLabel: ReactNode
    }
  | { onRetry?: undefined; retryLabel?: undefined }

type DetailsProps =
  | {
      /** Technical detail (a status code, a request id), collapsed behind `detailsLabel`. */
      details: ReactNode
      detailsLabel: ReactNode
    }
  | { details?: undefined; detailsLabel?: undefined }

type ErrorStateProps = Omit<ComponentProps<"div">, "title"> &
  RetryProps &
  DetailsProps & {
    title: ReactNode
    message?: ReactNode
    size?: EmptySize
  }

function ErrorState({
  title,
  message,
  onRetry,
  retryLabel,
  details,
  detailsLabel,
  size = "panel",
  className,
  ...props
}: ErrorStateProps) {
  return (
    <Empty
      size={size}
      data-tone="destructive"
      className={cn("data-[size=panel]:border-destructive/50", className)}
      {...props}
      render={<div data-slot="error-state" />}
    >
      {/* Spec: role="alert" announces everything inside it, so the buttons stay outside. */}
      <EmptyHeader role="alert">
        {size === "inline" ? null : (
          <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
            <CircleExclamationPointIcon />
          </EmptyMedia>
        )}
        <EmptyTitle>{title}</EmptyTitle>
        {message === undefined ? null : <EmptyDescription className="wrap-anywhere">{message}</EmptyDescription>}
      </EmptyHeader>
      {onRetry === undefined && details === undefined ? null : (
        <EmptyContent>
          {onRetry === undefined ? null : (
            <Button variant="outline" size="sm" onClick={() => onRetry()}>
              {retryLabel}
            </Button>
          )}
          {details === undefined ? null : (
            <Collapsible className="w-full items-center group-data-[size=inline]/empty:items-start">
              <CollapsibleTrigger className="min-h-control-sm text-muted-foreground">
                {detailsLabel}
                <CollapsibleIcon />
              </CollapsibleTrigger>
              <CollapsiblePanel>
                <div className="pt-items">
                  <pre className="max-w-full rounded-control bg-muted px-inset-item py-inset-item text-start font-mono text-caption whitespace-pre-wrap wrap-anywhere">
                    {details}
                  </pre>
                </div>
              </CollapsiblePanel>
            </Collapsible>
          )}
        </EmptyContent>
      )}
    </Empty>
  )
}

export { ErrorState }
export type { ErrorStateProps }
