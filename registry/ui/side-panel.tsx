"use client"

import { useId, useRef, type ReactNode } from "react"
import { XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ShortcutHint, ShortcutScope, useShortcut } from "@/components/ui/shortcuts"
import { cn } from "@/lib/utils"

type SidePanelLabels = {
  /** The close button's name. */
  close: string
}

const sidePanelLabels: SidePanelLabels = { close: "Close" }

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
  labels?: Partial<SidePanelLabels>
  className?: string
  children?: ReactNode
}

/**
 * A non-modal inspector beside a list: the list stays usable, Escape closes the panel, and focus that was inside
 * it returns to `returnFocus`. Shortcuts declared inside it (`Button shortcut`) run while it is open.
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
  labels: labelOverrides,
  className,
  children,
}: SidePanelProps) {
  const labels = { ...sidePanelLabels, ...labelOverrides }
  const titleId = useId()
  const descriptionId = useId()
  const panel = useRef<HTMLElement>(null)

  const close = () => {
    const active = document.activeElement
    const inside = active === null || active === document.body || panel.current?.contains(active) === true
    if (inside) returnFocus?.()?.focus()
    onOpenChange(false)
  }

  useShortcut("escape", close, { enabled: open, scope, allowInInput: true, description: labels.close })

  if (!open) return null
  return (
    <ShortcutScope
      name={scope}
      label={scopeLabel ?? (typeof title === "string" ? title : undefined)}
      active
      render={
        <aside
          ref={panel}
          aria-labelledby={titleId}
          aria-describedby={description === undefined ? undefined : descriptionId}
          data-slot="side-panel"
          className={cn(
            "flex min-h-0 w-(--side-panel-width,24rem) shrink-0 flex-col border-s bg-card/(--glass-opacity) text-card-foreground backdrop-surface narrow:absolute narrow:inset-0 narrow:z-sticky narrow:w-full narrow:border-s-0 narrow:bg-card",
            className,
          )}
        />
      }
    >
      {/* Like CardHeader: the heading grows from --card-heading-basis, so the actions wrap below it as soon as the
          title would get narrower than that, whatever their width; the close button keeps its corner. */}
      <header data-slot="side-panel-header" className="flex items-start gap-items border-b p-inset-surface">
        <div className="flex min-w-0 flex-1 flex-wrap items-start gap-x-group gap-y-items">
          <div
            data-slot="side-panel-heading"
            className="flex min-w-0 grow basis-(--card-heading-basis) flex-col gap-inline"
          >
            <h2 id={titleId} data-slot="side-panel-title" className="text-title-sm tracking-tight wrap-anywhere">
              {title}
            </h2>
            {description !== undefined && (
              <p id={descriptionId} data-slot="side-panel-description" className="text-body-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {actions === undefined ? null : (
            <div data-slot="side-panel-actions" className="flex max-w-full min-w-0 flex-wrap items-center gap-items">
              {actions}
            </div>
          )}
        </div>
        <span className="flex shrink-0 items-center gap-inline">
          <ShortcutHint keys="escape" />
          <Button variant="ghost" size="icon" onClick={close} aria-label={labels.close} aria-keyshortcuts="Escape">
            <XIcon />
          </Button>
        </span>
      </header>
      <div
        data-slot="side-panel-body"
        className="flex min-h-0 flex-1 flex-col gap-group overflow-y-auto p-inset-surface"
      >
        {children}
      </div>
    </ShortcutScope>
  )
}

export { SidePanel, sidePanelLabels }
export type { SidePanelLabels, SidePanelProps }
