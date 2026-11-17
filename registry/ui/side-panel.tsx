"use client"

import { useId, useRef, type ReactNode } from "react"
import { cva } from "class-variance-authority"
import { XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerBackdrop,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer"
import { ShortcutHint, ShortcutScope, useShortcut } from "@/components/ui/shortcuts"
import { narrowQuery, useMediaQuery } from "@/components/ui/use-media-query"
import { cn } from "@/lib/utils"

type SidePanelLabels = {
  /** The close button's name. */
  close: string
}

const sidePanelLabels: SidePanelLabels = { close: "Close" }

/**
 * Where the panel goes at the `narrow:` breakpoint. `stack` keeps it in the page flow, full width below the list;
 * `overlay` covers its positioned parent; `sheet` opens it as a modal bottom sheet.
 */
type SidePanelNarrow = "stack" | "overlay" | "sheet"

const sidePanelVariants = cva(
  "flex min-h-0 w-(--side-panel-width,24rem) shrink-0 flex-col border-s bg-card/(--glass-opacity) text-card-foreground backdrop-surface",
  {
    variants: {
      narrow: {
        // The parent wraps on narrow screens, so the full-width panel goes below the list instead of squeezing it.
        stack: "narrow:w-full narrow:border-s-0 narrow:border-t narrow:[:has(>&)]:flex-wrap",
        overlay: "narrow:absolute narrow:inset-0 narrow:z-sticky narrow:w-full narrow:border-s-0 narrow:bg-card",
        sheet: "",
      } satisfies Record<SidePanelNarrow, string>,
    },
  },
)

type SidePanelProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  /** Buttons for the header, after the title. */
  actions?: ReactNode
  /** Where focus goes when the panel closes with focus inside it: the row that opened it. */
  returnFocus?: () => HTMLElement | null | undefined
  /** The `ShortcutScope` name of the panel; its shortcuts run while it's open. */
  scope?: string
  /** How the `ShortcutsDialog` titles the panel's shortcuts; defaults to a plain-text `title`. */
  scopeLabel?: string
  /** Where the panel goes on narrow screens; `"stack"` by default. */
  narrow?: SidePanelNarrow
  labels?: Partial<SidePanelLabels>
  className?: string
  children?: ReactNode
}

/**
 * A non-modal inspector beside a list: the list stays usable, Escape closes the panel, and focus that was inside
 * it returns to `returnFocus`. Shortcuts declared inside it (`Button shortcut`) run while it is open. On narrow
 * screens it follows `narrow`.
 */
function SidePanel({
  open,
  onOpenChange,
  title,
  description,
  actions,
  returnFocus,
  scope = "side-panel",
  scopeLabel,
  narrow = "stack",
  labels: labelOverrides,
  className,
  children,
}: SidePanelProps) {
  const labels = { ...sidePanelLabels, ...labelOverrides }
  const titleId = useId()
  const descriptionId = useId()
  const panel = useRef<HTMLElement>(null)
  // The drawer asks for finalFocus after onOpenChange, when the caller may already have cleared what returnFocus reads.
  const sheetReturn = useRef<HTMLElement | null>(null)
  const sheet = useMediaQuery(narrowQuery) && narrow === "sheet"

  const close = () => {
    const active = document.activeElement
    const inside = active === null || active === document.body || panel.current?.contains(active) === true
    if (inside) returnFocus?.()?.focus()
    onOpenChange(false)
  }

  // The sheet is a modal Drawer, which takes Escape itself and returns focus through finalFocus.
  useShortcut("escape", close, { enabled: open && !sheet, scope, allowInInput: true, description: labels.close })

  const shortcutLabel = scopeLabel ?? (typeof title === "string" ? title : undefined)
  const body = (
    <div data-slot="side-panel-body" className="flex min-h-0 flex-1 flex-col gap-group overflow-y-auto p-inset-surface">
      {children}
    </div>
  )

  if (sheet) {
    return (
      <Drawer
        side="bottom"
        open={open}
        onOpenChange={(next) => {
          if (!next) sheetReturn.current = returnFocus?.() ?? null
          onOpenChange(next)
        }}
      >
        <DrawerBackdrop />
        <DrawerContent
          finalFocus={() => sheetReturn.current ?? returnFocus?.() ?? undefined}
          className="gap-0 overflow-hidden p-0"
        >
          <ShortcutScope
            name={scope}
            label={shortcutLabel}
            active={open}
            render={<div data-slot="side-panel" data-narrow="sheet" className="flex min-h-0 flex-1 flex-col" />}
          >
            <SidePanelHeader
              title={<DrawerTitle className="text-title-sm tracking-tight wrap-anywhere">{title}</DrawerTitle>}
              description={
                description === undefined ? null : (
                  <DrawerDescription data-slot="side-panel-description" className="text-body-sm">
                    {description}
                  </DrawerDescription>
                )
              }
              actions={actions}
              close={
                <DrawerClose variant="ghost" size="icon" aria-label={labels.close}>
                  <XIcon />
                </DrawerClose>
              }
            />
            {body}
          </ShortcutScope>
        </DrawerContent>
      </Drawer>
    )
  }

  if (!open) return null
  return (
    <ShortcutScope
      name={scope}
      label={shortcutLabel}
      active
      render={
        <aside
          ref={panel}
          aria-labelledby={titleId}
          aria-describedby={description === undefined ? undefined : descriptionId}
          data-slot="side-panel"
          data-narrow={narrow}
          className={cn(sidePanelVariants({ narrow }), className)}
        />
      }
    >
      <SidePanelHeader
        title={
          <h2 id={titleId} data-slot="side-panel-title" className="text-title-sm tracking-tight wrap-anywhere">
            {title}
          </h2>
        }
        description={
          description === undefined ? null : (
            <p id={descriptionId} data-slot="side-panel-description" className="text-body-sm text-muted-foreground">
              {description}
            </p>
          )
        }
        actions={actions}
        close={
          <>
            <ShortcutHint keys="escape" />
            <Button variant="ghost" size="icon" onClick={close} aria-label={labels.close} aria-keyshortcuts="Escape">
              <XIcon />
            </Button>
          </>
        }
      />
      {body}
    </ShortcutScope>
  )
}

type SidePanelHeaderProps = { title: ReactNode; description: ReactNode; actions: ReactNode; close: ReactNode }

// Like CardHeader: the heading grows from --card-heading-basis, so the actions wrap below it as soon as the title
// would get narrower than that, whatever their width; the close button keeps its corner.
function SidePanelHeader({ title, description, actions, close }: SidePanelHeaderProps) {
  return (
    <header data-slot="side-panel-header" className="flex shrink-0 items-start gap-items border-b p-inset-surface">
      <div className="flex min-w-0 flex-1 flex-wrap items-start gap-x-group gap-y-items">
        <div
          data-slot="side-panel-heading"
          className="flex min-w-0 grow basis-(--card-heading-basis) flex-col gap-inline"
        >
          {title}
          {description}
        </div>
        {actions === undefined ? null : (
          <div data-slot="side-panel-actions" className="flex max-w-full min-w-0 flex-wrap items-center gap-items">
            {actions}
          </div>
        )}
      </div>
      <span className="flex shrink-0 items-center gap-inline">{close}</span>
    </header>
  )
}

export { SidePanel, sidePanelLabels }
export type { SidePanelLabels, SidePanelNarrow, SidePanelProps }
