"use client"

import { useRef, useState, type FocusEvent } from "react"

import type { InboxItem } from "@/components/inbox-sample"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { List, ListItem } from "@/components/ui/list-item"
import { ScrollArea, ScrollAreaScrollbar, ScrollAreaViewport } from "@/components/ui/scroll-area"
import { formatShortcutSteps, ShortcutHint } from "@/components/ui/shortcuts"
import { ShortcutsDialog } from "@/components/ui/shortcuts-dialog"
import { SidePanel } from "@/components/ui/side-panel"
import { StatusDot } from "@/components/ui/status-pill"
import { useLocale } from "@/lib/locale"
import { cn } from "@/lib/utils"

const inboxCopy = {
  title: "Inbox",
  list: "Messages",
  unread: "Unread",
  pinned: "Pinned",
  selected: (count: number) => `${String(count)} selected`,
  markSelectedRead: "Mark selected read",
  clearSelection: "Clear selection",
  detail: "Item detail",
  markRead: "Mark read",
  markUnread: "Mark unread",
  toggleRead: "Mark read or unread",
  pin: "Pin",
  unpin: "Unpin",
  togglePin: "Pin or unpin",
  received: "Received",
  help: { before: "Press", after: "for shortcuts" },
  keys: {
    next: "Next message",
    previous: "Previous message",
    open: "Open the message",
    select: "Select the message",
    jump: "First or last message",
  },
}

type InboxProps = {
  items: readonly InboxItem[]
  locale?: string
  timeZone?: string
  className?: string
}

function primaryOf(root: HTMLElement | null, id: string | null) {
  if (!root || id === null) return null
  const title = root.querySelector(`[data-item-id="${CSS.escape(id)}"] [data-slot="list-item-title"]`)
  return title?.closest<HTMLElement>("a, button") ?? null
}

/**
 * A keyboard-first inbox: j/k move through thousands of messages, Enter opens one in a side panel whose actions
 * have single-key shortcuts, Escape closes it, x selects for a bulk action and ? lists every key.
 */
function Inbox({ items: initialItems, locale: localeProp, timeZone, className }: InboxProps) {
  const locale = useLocale(localeProp)
  const [items, setItems] = useState(initialItems)
  const [openId, setOpenId] = useState<string | null>(null)
  const [checked, setChecked] = useState<string[]>([])
  const listRoot = useRef<HTMLDivElement>(null)
  const open = items.find((item) => item.id === openId)
  const time = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone })
  const fullTime = new Intl.DateTimeFormat(locale, { dateStyle: "full", timeStyle: "short", timeZone })

  const update = (ids: readonly string[], change: (item: InboxItem) => Partial<InboxItem>) =>
    setItems((current) => current.map((item) => (ids.includes(item.id) ? { ...item, ...change(item) } : item)))

  const followFocus = (event: FocusEvent<HTMLDivElement>) => {
    if (openId === null || !(event.target instanceof Element)) return
    const id = event.target.closest<HTMLElement>("[data-item-id]")?.dataset.itemId
    if (id !== undefined && id !== openId) setOpenId(id)
  }

  return (
    <div
      data-slot="inbox"
      className={cn("flex min-h-0 flex-col overflow-hidden rounded-surface border bg-background", className)}
    >
      <header className="flex min-h-control-lg flex-wrap items-center gap-items border-b px-inset-item py-inline">
        <h2 className="text-title-sm tracking-tight">{inboxCopy.title}</h2>
        <span className="text-caption text-muted-foreground tabular-nums">{items.length}</span>
        {checked.length > 0 && (
          <div className="flex items-center gap-items">
            <span className="text-body-sm">{inboxCopy.selected(checked.length)}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                update(checked, () => ({ read: true }))
                setChecked([])
              }}
            >
              {inboxCopy.markSelectedRead}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setChecked([])}>
              {inboxCopy.clearSelection}
            </Button>
          </div>
        )}
        <span className="ms-auto flex items-center gap-inline text-caption text-muted-foreground">
          {inboxCopy.help.before}
          <ShortcutHint keys="?" />
          {inboxCopy.help.after}
        </span>
      </header>
      <div className="relative flex min-h-0 flex-1">
        <ScrollArea className="flex min-h-0 min-w-0 flex-1 flex-col">
          <ScrollAreaViewport
            className="h-auto min-h-0 flex-1 p-inline"
            render={(part) => <div {...part} data-slot="inbox-scroller" />}
          >
            <List
              ref={listRoot}
              aria-label={inboxCopy.list}
              items={items}
              itemText={(item) => `${item.subject} ${item.from}`}
              estimateSize={56}
              checkedIds={checked}
              onCheckedIdsChange={setChecked}
              onFocus={followFocus}
              renderItem={(item) => (
                <ListItem
                  id={item.id}
                  title={item.subject}
                  selected={item.id === openId}
                  onSelect={() => setOpenId(item.id)}
                  leading={
                    <StatusDot tone="info" label={inboxCopy.unread} className={item.read ? "invisible" : undefined} />
                  }
                  subtitle={`${item.from} · ${item.preview}`}
                  status={item.label && <Badge tone={item.label.tone}>{item.label.text}</Badge>}
                  trailing={
                    <>
                      {item.pinned && <Badge variant="outline">{inboxCopy.pinned}</Badge>}
                      <time dateTime={item.receivedAt} className="tabular-nums">
                        {time.format(new Date(item.receivedAt))}
                      </time>
                    </>
                  }
                  className={item.read ? "text-muted-foreground" : "font-medium"}
                />
              )}
            />
          </ScrollAreaViewport>
          <ScrollAreaScrollbar data-agent-hidden="" />
        </ScrollArea>
        <SidePanel
          open={open !== undefined}
          onOpenChange={(next) => {
            if (!next) setOpenId(null)
          }}
          title={open?.subject}
          description={open?.from}
          scope="inbox-detail"
          scopeLabel={inboxCopy.detail}
          narrow="overlay"
          returnFocus={() => primaryOf(listRoot.current, openId)}
        >
          {open && (
            <>
              <div className="flex flex-wrap gap-items">
                <Button
                  variant="outline"
                  size="sm"
                  shortcut="u"
                  shortcutDescription={inboxCopy.toggleRead}
                  onClick={() => update([open.id], (item) => ({ read: !item.read }))}
                >
                  {open.read ? inboxCopy.markUnread : inboxCopy.markRead}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  shortcut="p"
                  shortcutDescription={inboxCopy.togglePin}
                  onClick={() => update([open.id], (item) => ({ pinned: !item.pinned }))}
                >
                  {open.pinned ? inboxCopy.unpin : inboxCopy.pin}
                </Button>
              </div>
              <dl className="flex flex-wrap gap-x-group gap-y-inline text-body-sm">
                <dt className="text-muted-foreground">{inboxCopy.received}</dt>
                <dd>
                  <time dateTime={open.receivedAt}>{fullTime.format(new Date(open.receivedAt))}</time>
                </dd>
              </dl>
              <p className="text-body">{open.preview}</p>
            </>
          )}
        </SidePanel>
      </div>
      <ShortcutsDialog
        extra={[
          { keys: "j", steps: formatShortcutSteps("j"), description: inboxCopy.keys.next },
          { keys: "k", steps: formatShortcutSteps("k"), description: inboxCopy.keys.previous },
          { keys: "enter", steps: formatShortcutSteps("enter"), description: inboxCopy.keys.open },
          { keys: "x", steps: formatShortcutSteps("x"), description: inboxCopy.keys.select },
          { keys: "home", steps: ["Home", "End"], description: inboxCopy.keys.jump },
        ]}
      />
    </div>
  )
}

export { Inbox, inboxCopy }
export type { InboxItem, InboxProps }
