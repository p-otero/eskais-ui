"use client"

import { memo, type ReactNode } from "react"
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, CopyIcon, WrapTextIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { LogViewerLabels } from "@/components/ui/log-viewer-labels"
import type { LogViewerApi, SourceStyle } from "@/components/ui/log-viewer-rows"
import { SearchField } from "@/components/ui/search-field"
import { Toggle } from "@/components/ui/toggle"
import { ToggleGroup } from "@/components/ui/toggle-group"
import { cssVars } from "@/lib/utils"

type ToolbarProps = {
  api: LogViewerApi
  labels: LogViewerLabels
  sources: readonly string[]
  styles: Map<string, SourceStyle>
  hidden: readonly string[]
  query: string
  wrap: boolean
  copied: boolean
  errors: number
  search: boolean
  actions: ReactNode
}

const LogViewerToolbar = memo(function LogViewerToolbar({
  api,
  labels,
  sources,
  styles,
  hidden,
  query,
  wrap,
  copied,
  errors,
  search,
  actions,
}: ToolbarProps) {
  const shown = sources.filter((source) => !hidden.includes(source))
  return (
    <div data-slot="log-viewer-toolbar" className="flex flex-wrap items-center gap-items border-b p-inline">
      {sources.length > 1 && (
        <ToggleGroup
          multiple
          aria-label={labels.sources}
          value={shown}
          onValueChange={(value, details) =>
            api.setHiddenSources(
              sources.filter((source) => !value.includes(source)),
              { reason: "toggle-press", event: details.event },
            )
          }
          className="flex-wrap"
        >
          {sources.map((source) => {
            const style = styles.get(source)
            return (
              <Toggle key={source} value={source} variant="outline" size="sm" className="h-control-sm">
                <span
                  aria-hidden="true"
                  style={cssVars({ "--log-source": style?.color })}
                  className="size-2 rounded-full bg-(--log-source) ring-1 ring-background"
                />
                {style?.label ?? source}
              </Toggle>
            )
          })}
        </ToggleGroup>
      )}
      {search && (
        <SearchField
          label={labels.search}
          clearLabel={labels.clearSearch}
          value={query}
          onValueChange={(value, details) => api.search(value, { reason: "input-change", event: details.event })}
          className="w-auto min-w-40 flex-1"
        />
      )}
      <div className="ms-auto flex items-center gap-inline">
        {errors > 0 && (
          <span
            data-slot="log-viewer-errors"
            className="inline-flex h-control-sm items-center rounded-full bg-destructive-soft px-inset-chip text-caption font-medium text-destructive-soft-foreground tabular-nums"
          >
            <span aria-hidden="true">{errors}</span>
            <span className="sr-only">{labels.errors(errors)}</span>
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          aria-label={labels.previousError}
          disabled={errors === 0}
          onClick={(event) => api.previousError(event.nativeEvent)}
          data-agent-hidden=""
        >
          <ChevronUpIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={labels.nextError}
          disabled={errors === 0}
          onClick={(event) => api.nextError(event.nativeEvent)}
          data-agent-hidden=""
        >
          <ChevronDownIcon />
        </Button>
        <Toggle
          size="icon"
          aria-label={labels.wrap}
          pressed={wrap}
          onPressedChange={(pressed, details) => api.setWrap(pressed, { reason: "toggle-press", event: details.event })}
        >
          <WrapTextIcon />
        </Toggle>
        <Button
          variant="ghost"
          size="icon"
          aria-label={copied ? labels.copied : labels.copy}
          data-agent-hidden=""
          onClick={(event) => void api.copy(event.nativeEvent)}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </Button>
        {actions}
      </div>
    </div>
  )
})

export { LogViewerToolbar }
