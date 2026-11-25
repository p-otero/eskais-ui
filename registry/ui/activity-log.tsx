"use client"

import { createParts } from "@ui-sdk/react/primitive"
import { useSyncExternalStore, type ComponentProps, type ReactNode } from "react"
import { BotIcon, Redo2Icon, Undo2Icon, UserIcon, WorkflowIcon, type LucideIcon } from "lucide-react"

import { activityLog } from "@/components/ui/activity-log-primitive"
import type {
  ActivityActor,
  ActivityLog as ActivityLogStore,
  ActivityLogSnapshot,
} from "@/components/ui/activity-log-store"
import { Button } from "@/components/ui/button"
import { RelativeTime } from "@/components/ui/relative-time"
import { ScrollArea, ScrollAreaScrollbar, ScrollAreaViewport } from "@/components/ui/scroll-area"
import { toast } from "@/components/ui/toast"
import type { Instant } from "@/lib/time"
import { cn, cnState } from "@/lib/utils"

const Parts = createParts(activityLog, { root: "div", entry: "button" })

const emptySnapshot: ActivityLogSnapshot = { entries: [], position: 0, busy: false }
const noop = () => () => {}

function useActivityLog(log: ActivityLogStore | undefined): ActivityLogSnapshot {
  return useSyncExternalStore(
    log?.subscribe ?? noop,
    () => log?.getSnapshot() ?? emptySnapshot,
    () => log?.getSnapshot() ?? emptySnapshot,
  )
}

type ActivityLogLabels = {
  undo: string
  redo: string
  /** The entry that restores the page as it was before any change. */
  start: string
  empty: string
  /** Read after an entry that is undone, for screen readers. */
  undone: string
  /** Read after an entry `undoActor` took back. */
  reverted: string
  /** Read before each entry, for screen readers. */
  actors: Record<ActivityActor, string>
  /** What an agent asks a person before a seek that undoes more than `confirmAbove` entries. */
  confirmSeek: (count: number) => string
}

const activityLogLabels: ActivityLogLabels = {
  undo: "Undo",
  redo: "Redo",
  start: "Start",
  empty: "No changes yet",
  undone: "Undone",
  reverted: "Reverted",
  actors: { agent: "Agent", person: "Person", app: "App" },
  confirmSeek: (count) => `Undo the last ${String(count)} changes`,
}

const actorIcons = { agent: BotIcon, person: UserIcon, app: WorkflowIcon } satisfies Record<ActivityActor, LucideIcon>

function outsideTextField() {
  const active = typeof document === "undefined" ? null : document.activeElement
  if (!(active instanceof HTMLElement)) return true
  if (active.isContentEditable) return false
  if (active instanceof HTMLTextAreaElement) return false
  return (
    !(active instanceof HTMLInputElement) || ["checkbox", "radio", "button", "range", "color"].includes(active.type)
  )
}

type ActivityLogProps = Omit<ComponentProps<typeof Parts.Root>, "log" | "children"> & {
  log: ActivityLogStore
  /** Names the log, for screen readers and agents. */
  label: string
  labels?: Partial<Omit<ActivityLogLabels, "actors">> & { actors?: Partial<ActivityLogLabels["actors"]> }
  /** A heading beside Undo and Redo. */
  header?: ReactNode
  /** Seeks that undo more entries than this need a person's approval when an agent asks for them. */
  confirmAbove?: number
  /** Binds Cmd/Ctrl+Z and Shift+Cmd/Ctrl+Z, listed in `ShortcutsDialog`. Turn off for a second log on the page. */
  shortcuts?: boolean
  /** Pass one `useNow()` per screen. */
  now?: Instant
  locale?: string
}

/** Newest first. Pressing an entry puts the page back to just after it; Undo and Redo step one entry. */
function ActivityLog({
  log,
  label,
  labels: labelsProp,
  header,
  confirmAbove = 3,
  shortcuts = true,
  now,
  locale,
  className,
  ...props
}: ActivityLogProps) {
  const labels = { ...activityLogLabels, ...labelsProp, actors: { ...activityLogLabels.actors, ...labelsProp?.actors } }
  const { entries, position } = useActivityLog(log)
  const confirm = (target: number) =>
    position - target > confirmAbove ? labels.confirmSeek(position - target) : undefined
  const entryClassName =
    "flex w-full items-start gap-items rounded-control px-inset-item py-inset-item text-start text-body-sm outline-none transition-colors duration-micro ease-standard hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring aria-[current=step]:bg-accent aria-[current=step]:text-accent-foreground data-[state=undone]:text-muted-foreground disabled:cursor-not-allowed"

  return (
    <Parts.Root
      log={log}
      aria-label={label}
      className={cnState("flex min-h-0 flex-col gap-items", className)}
      {...props}
    >
      {({ canUndo, canRedo }) => (
        <>
          <div data-slot="activity-log-header" className="flex items-center gap-inline">
            <div className="min-w-0 flex-1">{header}</div>
            <Button
              variant="ghost"
              size="icon"
              aria-label={labels.undo}
              shortcut={shortcuts ? "mod+z" : undefined}
              shortcutWhen={outsideTextField}
              disabled={!canUndo}
              onClick={() => log.undo()}
            >
              <Undo2Icon className="rtl:-scale-x-100" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={labels.redo}
              shortcut={shortcuts ? "mod+shift+z" : undefined}
              shortcutWhen={outsideTextField}
              disabled={!canRedo}
              onClick={() => log.redo()}
            >
              <Redo2Icon className="rtl:-scale-x-100" />
            </Button>
          </div>
          {entries.length === 0 ? (
            <p data-slot="activity-log-empty" className="px-inset-item text-body-sm text-muted-foreground">
              {labels.empty}
            </p>
          ) : (
            <ScrollArea className="flex min-h-0 flex-col">
              <ScrollAreaViewport
                className="flex h-auto min-h-0 flex-1 flex-col"
                render={(part) => <ol {...part} data-slot="activity-log-list" />}
              >
                {entries.toReversed().map((entry, reversedIndex) => {
                  const target = entries.length - reversedIndex
                  const Icon = actorIcons[entry.actor]
                  return (
                    <li key={entry.id} data-actor={entry.actor} className="flex">
                      <Parts.Entry
                        value={String(target)}
                        data-agent-confirm={confirm(target)}
                        className={entryClassName}
                      >
                        <Icon aria-hidden className="mt-px size-3.5 shrink-0 text-muted-foreground" />
                        <span className="flex min-w-0 flex-col">
                          <span className={cn(entry.reverted && "line-through")}>
                            <span className="sr-only">{labels.actors[entry.actor]}: </span>
                            {entry.description}
                          </span>
                          <span className="flex flex-wrap items-baseline gap-x-inline text-caption text-muted-foreground">
                            {entry.row !== undefined && <span className="truncate">{entry.row}</span>}
                            <RelativeTime value={entry.at} now={now} locale={locale} formatStyle="short" />
                            {target > position && <span className="sr-only">{labels.undone}</span>}
                            {entry.reverted && <span>{labels.reverted}</span>}
                          </span>
                        </span>
                      </Parts.Entry>
                    </li>
                  )
                })}
                <li className="flex">
                  <Parts.Entry value="0" data-agent-confirm={confirm(0)} className={entryClassName}>
                    {labels.start}
                  </Parts.Entry>
                </li>
              </ScrollAreaViewport>
              <ScrollAreaScrollbar data-agent-hidden="" />
            </ScrollArea>
          )}
        </>
      )}
    </Parts.Root>
  )
}

type UndoToastOptions = {
  /** Takes the change back. Without it, `log` steps back to just before the newest entry. */
  onUndo?: () => unknown
  log?: Pick<ActivityLogStore, "getSnapshot" | "seek">
  description?: string
  labels?: { undo?: string }
  /** A queue from `createToaster()`; the shared one by default. */
  toaster?: typeof toast
}

/** A toast with an Undo action, for a change that just happened: `undoToast("Task archived", { log })`. */
function undoToast(title: string, { onUndo, log, description, labels, toaster }: UndoToastOptions = {}) {
  let before = log ? log.getSnapshot().position - 1 : undefined
  queueMicrotask(function rereadOnceTheChangeCallbackRecorded() {
    if (log) before = log.getSnapshot().position - 1
  })
  const show = toaster ?? toast
  return show(title, {
    description,
    action: {
      label: labels?.undo ?? activityLogLabels.undo,
      onAction: () => (onUndo ? onUndo() : before !== undefined && before >= 0 ? log?.seek(before) : undefined),
    },
  })
}

export { ActivityLog, activityLogLabels, undoToast, useActivityLog }
export type { ActivityLogLabels, ActivityLogProps, UndoToastOptions }
