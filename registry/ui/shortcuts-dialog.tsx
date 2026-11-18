"use client"

import { useState, type ComponentProps, type MouseEvent, type ReactNode } from "react"

import {
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { listShortcuts, useShortcut, type ListedShortcut } from "@/components/ui/shortcuts"
import { cn } from "@/lib/utils"

type ShortcutsDialogLabels = {
  title: string
  /** The group of shortcuts that belong to no scope. */
  global: string
  /** What the shortcut that opens the dialog is listed as. */
  open: string
  description?: ReactNode
}

const shortcutsDialogLabels: ShortcutsDialogLabels = {
  title: "Keyboard shortcuts",
  global: "General",
  open: "Show keyboard shortcuts",
}

type ShortcutsDialogProps = {
  /** The key that opens it; `null` registers none, for a dialog you open with `open`. */
  shortcut?: string | null
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  labels?: Partial<ShortcutsDialogLabels>
  /** Extra rows that aren't registered shortcuts, like a list's own keys. */
  extra?: readonly ListedShortcut[]
  className?: string
  /** A `ShortcutsDialogTrigger`, the way in without a keyboard. */
  children?: ReactNode
}

const noExtra: readonly ListedShortcut[] = []

type Group = { key: string; label: string; items: ListedShortcut[] }

function groupByScope(items: readonly ListedShortcut[], globalLabel: string) {
  const groups = new Map<string, Group>()
  for (const item of items) {
    const key = item.scope ?? ""
    const group = groups.get(key) ?? { key, label: item.scopeLabel ?? item.scope ?? globalLabel, items: [] }
    if (!group.items.some((existing) => existing.keys === item.keys)) group.items.push(item)
    groups.set(key, group)
  }
  return [...groups.values()].toSorted((a, b) => Number(b.key === "") - Number(a.key === ""))
}

/**
 * A "?" dialog listing the shortcuts that can run where the person is, grouped by scope. It reads them as it
 * opens, before the modal pauses the page's shortcuts.
 */
function ShortcutsDialog({
  shortcut = "?",
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  labels: labelOverrides,
  extra = noExtra,
  className,
  children,
}: ShortcutsDialogProps) {
  const labels = { ...shortcutsDialogLabels, ...labelOverrides }
  const [ownOpen, setOwnOpen] = useState(defaultOpen)
  const open = openProp ?? ownOpen
  const [snapshot, setSnapshot] = useState<ListedShortcut[] | null>(null)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open && snapshot === null) setSnapshot(listShortcuts())
    if (!open) setSnapshot(null)
  }

  const setOpen = (next: boolean) => {
    if (openProp === undefined) setOwnOpen(next)
    onOpenChange?.(next)
  }

  useShortcut(
    shortcut,
    () => {
      setSnapshot(listShortcuts())
      setOpen(true)
    },
    { scope: null, description: labels.open, when: () => !open },
  )

  const groups = groupByScope([...extra, ...(snapshot ?? [])], labels.global)

  return (
    <Dialog open={open} onOpenChange={(next) => setOpen(next)}>
      {children}
      <DialogBackdrop />
      <DialogContent
        size="md"
        className={cn("max-h-(--dialog-max-height)", className)}
        render={<div data-slot="shortcuts-dialog" />}
      >
        <DialogHeader>
          <DialogTitle>{labels.title}</DialogTitle>
          {labels.description !== undefined && <DialogDescription>{labels.description}</DialogDescription>}
        </DialogHeader>
        <DialogBody className="gap-group">
          {groups.map((group) => (
            <section key={group.key} aria-label={group.label} className="flex flex-col gap-inline">
              <h3 className="text-meta tracking-meta text-muted-foreground uppercase">{group.label}</h3>
              <dl className="flex flex-col">
                {group.items.map((item) => (
                  <div
                    key={item.keys}
                    data-slot="shortcuts-dialog-row"
                    className="flex items-center justify-between gap-items border-b py-inset-item text-body last:border-0"
                  >
                    <dt>{item.description}</dt>
                    <dd>
                      <KbdGroup>
                        {item.steps.map((step, index) => (
                          <Kbd key={`${String(index)}-${step}`}>{step}</Kbd>
                        ))}
                      </KbdGroup>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Opens the `ShortcutsDialog` it sits in, for touch screens and anyone who doesn't know "?". A `Button` look
 * (`variant`, `size`); give it visible text or an `aria-label`. It lists the shortcuts of the `ShortcutScope` it is in.
 */
function ShortcutsDialogTrigger({ onClick, ...props }: ComponentProps<typeof DialogTrigger>) {
  // Safari and touch don't focus a pressed button, and a scope is active while focus is inside it, so take focus
  // before the dialog reads the shortcuts that can run here.
  const focusFirst = (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event)
    event.currentTarget.focus({ preventScroll: true })
  }
  return <DialogTrigger onClick={focusFirst} {...props} />
}

export { ShortcutsDialog, ShortcutsDialogTrigger, shortcutsDialogLabels }
export type { ShortcutsDialogLabels, ShortcutsDialogProps }
