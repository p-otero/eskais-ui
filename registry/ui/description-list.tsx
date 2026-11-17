"use client"

import { renderElement, usePart, usePrimitive, type PartProps } from "@ui-sdk/react/primitive"
import { cva } from "class-variance-authority"
import { CheckIcon, CopyIcon } from "lucide-react"
import { createContext, use, useId, useMemo, type CSSProperties, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { descriptionValue, type DescriptionValueOptions } from "@/components/ui/description-list-primitive"
import { cn } from "@/lib/utils"

type DescriptionListLayout = "stacked" | "inline" | "grid"

type DescriptionListLabels = {
  /** Read by screen readers in place of an empty value, which shows a dash. */
  empty: string
  /** The copy button's name. */
  copy: string
  /** Announced, and the button's name, once the value is copied. */
  copied: string
}

const descriptionListLabels: DescriptionListLabels = { empty: "Not set", copy: "Copy", copied: "Copied" }

type ListContextValue = { layout: DescriptionListLayout; labels: DescriptionListLabels }

const ListContext = createContext<ListContextValue>({ layout: "stacked", labels: descriptionListLabels })
const ItemContext = createContext<{ termId: string } | null>(null)

const listVariants = cva("min-w-0", {
  variants: {
    layout: {
      stacked: "flex flex-col gap-group",
      // A container, so each row puts its term beside its details only while the list is wide enough.
      inline: "@container/description-list flex flex-col divide-y",
      grid: "grid grid-cols-(--description-grid) gap-x-section gap-y-group",
    },
  },
})

const itemVariants = cva("flex min-w-0 flex-col gap-inline", {
  variants: {
    layout: {
      stacked: "",
      inline:
        "py-items first:pt-0 last:pb-0 @sm/description-list:flex-row @sm/description-list:items-baseline @sm/description-list:gap-group",
      grid: "",
    },
  },
})

const termVariants = cva("text-body-sm text-muted-foreground", {
  variants: {
    layout: {
      stacked: "",
      inline: "@sm/description-list:w-(--description-term-width,33%) @sm/description-list:shrink-0",
      grid: "",
    },
  },
})

type DescriptionListProps = PartProps<"dl"> & {
  /** `stacked` (default): each term above its details. `inline`: side by side, stacked in a narrow container. `grid`: items in columns. */
  layout?: DescriptionListLayout
  /** The most columns `grid` uses; fewer while a column would get narrower than `--description-column-min` (12rem). */
  columns?: number
  labels?: Partial<DescriptionListLabels>
}

type ListStyle = DescriptionListProps["style"]

// As many columns as fit at --description-column-min (12rem), never more than `columns`: each track is at least the
// width that `columns` would give it.
function gridStyle(columns: number, style: ListStyle): ListStyle {
  const share = `calc((100% - ${String(columns - 1)} * var(--gap-section)) / ${String(columns)})`
  const variables = {
    "--description-grid": `repeat(auto-fill, minmax(min(100%, max(var(--description-column-min, 12rem), ${share})), 1fr))`,
  } as CSSProperties
  if (typeof style === "function") return (state) => ({ ...variables, ...style(state) })
  return { ...variables, ...style }
}

function DescriptionList({
  layout = "stacked",
  columns = 3,
  labels: labelOverrides,
  className,
  style,
  render,
  ...props
}: DescriptionListProps) {
  const context = useMemo(
    () => ({ layout, labels: { ...descriptionListLabels, ...labelOverrides } }),
    [layout, labelOverrides],
  )
  return (
    <ListContext value={context}>
      {renderElement(
        "dl",
        {
          "data-slot": "description-list",
          "data-layout": layout,
          className: cn(listVariants({ layout }), className),
          style: layout === "grid" ? gridStyle(columns, style) : style,
          ...props,
        },
        render,
      )}
    </ListContext>
  )
}

/** One term and its details. A `div` is the one wrapper HTML allows inside a `dl`. */
function DescriptionItem({ className, render, ...props }: PartProps<"div">) {
  const { layout } = use(ListContext)
  const termId = useId()
  const item = useMemo(() => ({ termId }), [termId])
  return (
    <ItemContext value={item}>
      {renderElement(
        "div",
        { "data-slot": "description-item", className: cn(itemVariants({ layout }), className), ...props },
        render,
      )}
    </ItemContext>
  )
}

function DescriptionTerm({ className, render, id, ...props }: PartProps<"dt">) {
  const { layout } = use(ListContext)
  const item = use(ItemContext)
  return renderElement(
    "dt",
    {
      "data-slot": "description-term",
      id: id ?? item?.termId,
      className: cn(termVariants({ layout }), className),
      ...props,
    },
    render,
  )
}

type DescriptionDetailsProps = PartProps<"dd"> & {
  /** Sets the value in the monospace face, for ids, hashes and keys. */
  mono?: boolean
  /** Adds a copy button, and a `copy` action for agents named by the term. */
  copyable?: boolean
  /** The text to copy; defaults to the details when they are a string or a number. */
  copyValue?: string
  onCopy?: DescriptionValueOptions["onCopy"]
}

function isEmpty(children: unknown) {
  return children === undefined || children === null || children === false || children === ""
}

function DescriptionDetails({
  mono = false,
  copyable = false,
  copyValue,
  onCopy,
  className,
  render,
  children,
  ...props
}: DescriptionDetailsProps) {
  const { labels } = use(ListContext)
  const empty = isEmpty(children)
  let content: ReactNode = children as ReactNode
  if (empty) {
    content = (
      <>
        <span aria-hidden="true">—</span>
        <span className="sr-only">{labels.empty}</span>
      </>
    )
  } else if (copyable) {
    const text = copyValue ?? (typeof children === "string" || typeof children === "number" ? String(children) : "")
    content = (
      <CopyableValue text={text} onCopy={onCopy} labels={labels}>
        {children as ReactNode}
      </CopyableValue>
    )
  }
  return renderElement(
    "dd",
    {
      "data-slot": "description-details",
      "data-empty": empty ? "" : undefined,
      "data-mono": mono ? "" : undefined,
      className: cn("min-w-0 text-body break-words data-empty:text-muted-foreground data-mono:font-mono", className),
      ...props,
      children: content,
    },
    render,
  )
}

type CopyableValueProps = DescriptionValueOptions & { labels: DescriptionListLabels; children: ReactNode }

function CopyableValue({ text, onCopy, labels, children }: CopyableValueProps) {
  const item = use(ItemContext)
  const handle = usePrimitive(descriptionValue, { text, onCopy })
  return usePart(
    handle,
    "root",
    {},
    {
      ...({ "data-slot": "description-value" } as Record<`data-${string}`, string>),
      "aria-labelledby": item?.termId,
      className: "flex min-w-0 items-center gap-inline",
      children: ({ copied }: { copied: boolean }) => (
        <>
          <span className="min-w-0">{children}</span>
          <Button
            variant="ghost"
            size="icon"
            aria-label={copied ? labels.copied : labels.copy}
            // The group's own copy action serves agents; the button would repeat it under a name every row shares.
            data-agent-hidden=""
            className="size-control-sm shrink-0 text-muted-foreground"
            onClick={(event) => handle.api.copy(event.nativeEvent)}
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
          </Button>
          <output className="sr-only">{copied ? labels.copied : ""}</output>
        </>
      ),
    },
    "span",
  )
}

export { DescriptionDetails, DescriptionItem, DescriptionList, descriptionListLabels, DescriptionTerm }
export type { DescriptionDetailsProps, DescriptionListLabels, DescriptionListLayout, DescriptionListProps }
