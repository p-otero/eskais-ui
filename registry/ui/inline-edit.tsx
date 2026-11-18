"use client"

import { createParts } from "@ui-sdk/react/primitive"
import { useId, type ComponentProps, type ReactNode } from "react"
import { PencilIcon } from "lucide-react"

import { inlineEdit, type InlineEditOptions, type InlineEditReason } from "@/components/ui/inline-edit-primitive"
import { ControlTooltip } from "@/components/ui/tooltip"
import { cn, cnState } from "@/lib/utils"

const {
  Root: InlineEditRoot,
  Display: InlineEditDisplay,
  Trigger: InlineEditTrigger,
  Input: InlineEditInput,
} = createParts(inlineEdit, { root: "div", display: "button", trigger: "button", input: "input" })

type InlineEditLabels = {
  /** Names the edit button, and its tooltip, from the field's label. */
  edit: (label: string) => string
  /** Tells screen readers how to start editing. */
  hint: string
}

const inlineEditLabels: InlineEditLabels = {
  edit: (label) => `Rename ${label}`,
  hint: "Press Enter or F2 to rename",
}

type InlineEditProps = Omit<ComponentProps<typeof InlineEditRoot>, "children"> & {
  /** Names the group and the field while editing, like "Project name". */
  label: string
  /** Shows an edit button (a pencil with a tooltip) beside the text; `false` for none, as in a dense list. */
  editButton?: boolean
  /** What the text shows, when it isn't the value itself. */
  children?: ReactNode
  labels?: Partial<InlineEditLabels>
  /** The text's size, shared by the field so nothing moves when editing starts: `body`, or a title's. */
  size?: InlineEditSize
}

type InlineEditSize = "body" | "title-sm" | "title"

const sizeClassNames = {
  body: "text-body",
  "title-sm": "text-title-sm tracking-tight",
  title: "text-title tracking-tight",
} satisfies Record<InlineEditSize, string>

const textBoxClassName =
  "min-w-0 rounded-control px-inline py-px text-start outline-none focus-visible:ring-2 focus-visible:ring-ring"

/**
 * Renames in place: a press (or a double click with `startOn="double-click"`), Enter, F2 or typing turns the text
 * into a field. Enter and Tab save, Escape puts the text back, and leaving the field saves too, or cancels with
 * `blur="cancel"`. `validate` returning `false` keeps editing. Agents call `rename(text)` and `cancel`.
 */
function InlineEdit({
  label,
  editButton = true,
  children,
  labels: ownLabels,
  size = "body",
  className,
  ...props
}: InlineEditProps) {
  const labels = { ...inlineEditLabels, ...ownLabels }
  const hint = useId()
  const editLabel = labels.edit(label)
  return (
    <InlineEditRoot
      aria-label={label}
      className={cnState("group/inline-edit inline-flex max-w-full min-w-0 items-center gap-inline", className)}
      {...props}
    >
      {(state) => (
        <>
          {state.editing ? (
            <InlineEditInput
              aria-label={label}
              className={cn(
                textBoxClassName,
                "field-sizing-content max-w-full bg-field text-inherit ring-2 ring-ring pointer-coarse:text-entry",
                // oxlint-disable-next-line shadcn/require-static-classes -- one of three static sizes
                sizeClassNames[size],
              )}
            />
          ) : (
            <InlineEditDisplay
              aria-describedby={hint}
              className={cn(
                textBoxClassName,
                "cursor-text truncate hover:bg-accent hover:text-accent-foreground aria-disabled:cursor-default aria-disabled:hover:bg-transparent",
                // oxlint-disable-next-line shadcn/require-static-classes -- one of three static sizes
                sizeClassNames[size],
              )}
            >
              {children ?? state.value}
            </InlineEditDisplay>
          )}
          {editButton && !state.editing ? (
            <ControlTooltip label={editLabel}>
              <InlineEditTrigger
                aria-label={editLabel}
                className="touch-target inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-control text-muted-foreground opacity-0 transition-opacity duration-micro ease-standard outline-none group-hover/inline-edit:opacity-100 group-focus-within/inline-edit:opacity-100 hover:bg-accent hover:text-accent-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:opacity-100 disabled:hidden [&_svg]:size-3.5"
              >
                <PencilIcon />
              </InlineEditTrigger>
            </ControlTooltip>
          ) : null}
          <span id={hint} hidden>
            {labels.hint}
          </span>
        </>
      )}
    </InlineEditRoot>
  )
}

export { InlineEdit, InlineEditDisplay, InlineEditInput, InlineEditRoot, InlineEditTrigger, inlineEditLabels }
export type { InlineEditLabels, InlineEditOptions, InlineEditProps, InlineEditReason, InlineEditSize }
