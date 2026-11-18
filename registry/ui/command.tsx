"use client"

import {
  Command as CommandPrimitive,
  CommandEmpty as CommandEmptyPrimitive,
  CommandGroup as CommandGroupPrimitive,
  CommandGroupLabel as CommandGroupLabelPrimitive,
  CommandInput as CommandInputPrimitive,
  CommandItem as CommandItemPrimitive,
  CommandItemIcon as CommandItemIconPrimitive,
  CommandItemText,
  CommandList as CommandListPrimitive,
  CommandPage,
  CommandSeparator as CommandSeparatorPrimitive,
  CommandShortcut as CommandShortcutPrimitive,
  CommandStatus as CommandStatusPrimitive,
  createCommandController,
  type CommandData,
  type CommandDataItem,
} from "@ui-sdk/react/command"
import { mergeProps } from "@ui-sdk/react/primitive"
import { createContext, memo, use, useCallback, useState, type ComponentProps, type ReactNode } from "react"
import { SearchIcon } from "lucide-react"

import { isHashRoute, useFastLink } from "@/components/ui/fast-link"
import { Kbd } from "@/components/ui/kbd"
import { isPlainClick } from "@/components/ui/link-primitive"
import {
  COMMAND_VIRTUALIZE_THRESHOLD,
  createCommandHighlight,
  useCommandRows,
  type CommandHighlight,
  type CommandRow as CommandRowData,
} from "@/components/ui/use-command-rows"
import { useHighlightFirstOnOpen } from "@/components/ui/use-command-reset"
import type { Virtualize } from "@/components/ui/virtual-rows"
import { cn, cnState } from "@/lib/utils"

const HighlightContext = createContext<CommandHighlight | null>(null)

type CommandHost = {
  /** Whether the dialog around the command list is open. */
  open: boolean
  /** Set when Escape should close the dialog instead of clearing the search or going back a page. */
  closeOnEscape?: (event: Event | undefined) => void
}

/** Set by CommandDialogContent, so a Command inside starts fresh on every open and Escape can close the dialog. */
const CommandHostContext = createContext<CommandHost | null>(null)

/** Whether an Escape that would clear the search or go back a page closes the dialog instead. */
function escapeClosesHost(host: CommandHost | null, details: { reason: string; event?: Event; cancel: () => void }) {
  if (details.reason !== "escape-key" || !host?.closeOnEscape) return false
  details.cancel()
  host.closeOnEscape(details.event)
  return true
}

type CommandProps = ComponentProps<typeof CommandPrimitive>

// A modified click on a link command stays native (a new tab), so CommandLinkItem can't cancel it, and UI SDK then
// runs the command's onAction with that click. A link command never runs onAction.
function isModifiedLinkPress(event: Event | undefined) {
  return (
    event instanceof MouseEvent &&
    !isPlainClick(event) &&
    event.target instanceof Element &&
    event.target.closest("a[href]") !== null
  )
}

const noPages: string[] = []

/**
 * Inside a CommandDialogContent, each open starts from `defaultQuery` (empty by default), on `defaultPages` (the
 * first page), with the best match highlighted. A `query` or `pages` you control is left to you.
 */
function Command({
  className,
  query: queryProp,
  defaultQuery = "",
  onQueryChange,
  pages: pagesProp,
  defaultPages = noPages,
  onPagesChange,
  onAction,
  onValueChange,
  controller: controllerProp,
  autoHighlight,
  ref,
  ...props
}: CommandProps) {
  const host = use(CommandHostContext)
  const [highlight] = useState(createCommandHighlight)
  const [ownController] = useState(createCommandController)
  const controller = controllerProp ?? ownController
  const [root, setRoot] = useState<HTMLElement | null>(null)
  const rootRef = useCallback(
    (node: HTMLDivElement | null) => {
      setRoot(node)
      if (typeof ref === "function") return ref(node)
      if (ref) ref.current = node
      return undefined
    },
    [ref],
  )
  // Controlled here rather than remounted on open: a closed dialog can stay mounted (keepMounted, or an exit
  // animation that never ends), and a remount would replace the input the dialog has just focused.
  const [ownQuery, setOwnQuery] = useState(defaultQuery)
  const [ownPages, setOwnPages] = useState(defaultPages)
  const open = host?.open ?? false
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setOwnQuery(defaultQuery)
      setOwnPages(defaultPages)
    }
  }
  const hosted = host !== null
  useHighlightFirstOnOpen(open, hosted && autoHighlight !== false && props.value === undefined, controller, root)
  return (
    <HighlightContext value={highlight}>
      <CommandPrimitive
        className={cnState(
          "flex w-full flex-col overflow-hidden rounded-surface bg-popover/(--glass-opacity) text-popover-foreground in-data-[slot=dialog-content]:rounded-none in-data-[slot=dialog-content]:bg-transparent",
          className,
        )}
        query={queryProp ?? (hosted ? ownQuery : undefined)}
        defaultQuery={hosted ? undefined : defaultQuery}
        onQueryChange={(query, details) => {
          if (escapeClosesHost(host, details)) return
          onQueryChange?.(query, details)
          if (!details.canceled) setOwnQuery(query)
        }}
        pages={pagesProp ?? (hosted ? ownPages : undefined)}
        defaultPages={hosted ? undefined : defaultPages}
        onPagesChange={(pages, details) => {
          if (escapeClosesHost(host, details)) return
          onPagesChange?.(pages, details)
          if (!details.canceled) setOwnPages(pages)
        }}
        onAction={(value, details) => (isModifiedLinkPress(details.event) ? undefined : onAction?.(value, details))}
        onValueChange={(value, details) => {
          highlight.set(details.index, details.reason)
          onValueChange?.(value, details)
        }}
        controller={controller}
        autoHighlight={autoHighlight}
        ref={rootRef}
        {...props}
      />
    </HighlightContext>
  )
}

function CommandInput({ className, ...props }: ComponentProps<typeof CommandInputPrimitive>) {
  return (
    <div data-slot="command-input-wrapper" className="flex items-center gap-inline border-b px-control-x">
      <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
      <CommandInputPrimitive
        className={cnState(
          "h-control-lg w-full min-w-0 bg-transparent text-entry outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    </div>
  )
}

function CommandList({ className, ...props }: ComponentProps<typeof CommandListPrimitive>) {
  return (
    <CommandListPrimitive
      className={cnState(
        "max-h-80 scroll-py-inline overflow-x-hidden overflow-y-auto overscroll-contain p-inline",
        className,
      )}
      {...props}
    />
  )
}

function CommandEmpty({ className, ...props }: ComponentProps<typeof CommandEmptyPrimitive>) {
  return (
    <CommandEmptyPrimitive
      className={cnState("py-section text-center text-sm text-muted-foreground not-data-empty:hidden", className)}
      {...props}
    />
  )
}

function CommandStatus({ className, ...props }: ComponentProps<typeof CommandStatusPrimitive>) {
  return (
    <CommandStatusPrimitive
      className={cnState("px-inset-item py-inset-item text-xs text-muted-foreground empty:hidden", className)}
      {...props}
    />
  )
}

function CommandGroup({ className, ...props }: ComponentProps<typeof CommandGroupPrimitive>) {
  return <CommandGroupPrimitive className={cnState("flex flex-col not-first:pt-inline", className)} {...props} />
}

function CommandGroupLabel({ className, ...props }: ComponentProps<typeof CommandGroupLabelPrimitive>) {
  return <CommandGroupLabelPrimitive className={cnState(groupLabelClass, className)} {...props} />
}

const commandItemClassName =
  "relative flex h-control-sm shrink-0 cursor-default items-center gap-inline rounded-control px-inset-item text-sm outline-none select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:opacity-50 data-pending:cursor-progress [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0"

type CommandItemFollowDetails = { event: Event }

type CommandItemProps = ComponentProps<typeof CommandItemPrimitive> & {
  /**
   * Renders the command as a link that navigates instead of running `onAction`: Enter, a click, its shortcut or a
   * mouse press (see `fast`) follow it. Modified clicks keep the browser's behaviour, like opening a new tab.
   */
  href?: string
  /** Takes over following, for client-side routing or to close the palette first. Receives the authored `href`. */
  onFollow?: (href: string, details: CommandItemFollowDetails) => void
  /**
   * Follows a same-origin link on mouse press, not release (default `true`): navigation only, as moving away can't
   * cancel it (WCAG 2.5.2). Off with a `target` or `download`; `data-no-fast-link` on an ancestor turns a region off.
   */
  fast?: boolean
  target?: string
  rel?: string
  download?: boolean | string
}

function CommandItem({ className, href, onFollow, fast = true, ...props }: CommandItemProps) {
  if (href === undefined) {
    return (
      <CommandItemPrimitive data-value={props.value} className={cnState(commandItemClassName, className)} {...props} />
    )
  }
  return <CommandLinkItem className={className} href={href} onFollow={onFollow} fast={fast} {...props} />
}

function followCommandLink(
  anchor: HTMLAnchorElement | null,
  href: string,
  event: Event,
  onFollow?: CommandItemProps["onFollow"],
) {
  if (onFollow) {
    onFollow(href, { event })
    return
  }
  const view = anchor?.ownerDocument.defaultView ?? window
  const url = new URL(href, view.document.baseURI)
  if (anchor && isHashRoute(anchor, href)) view.location.hash = url.hash
  else view.location.assign(url.href)
}

// UI SDK runs a link command (`onSelect`, then `onAction`) on the click that follows it, and runs its shortcut with
// no click at all. Taking the run over makes every way in follow the link and none run `onAction`, the mouse press
// included, whose click fast links cancel.
function CommandLinkItem({
  className,
  href,
  onFollow,
  fast,
  target,
  rel,
  download,
  onSelect,
  render,
  ...props
}: CommandItemProps & { href: string }) {
  const [anchor, setAnchor] = useState<HTMLAnchorElement | null>(null)
  const native = (target !== undefined && target !== "_self") || download !== undefined
  const fastRef = useFastLink<HTMLAnchorElement>({
    enabled: fast !== false && !native,
    anchorRole: "option",
    onFollow: onFollow && ((authored, { event }) => onFollow(authored, { event })),
  })
  const select = (event: Event) => {
    const result = onSelect?.(event)
    if (event.defaultPrevented || native || (event instanceof MouseEvent && !isPlainClick(event))) return result
    event.preventDefault()
    followCommandLink(anchor, href, event, onFollow)
    return result
  }
  const ref = useCallback(
    (node: HTMLAnchorElement | null) => {
      setAnchor(node)
      fastRef(node)
    },
    [fastRef],
  )
  return (
    <CommandItemPrimitive
      className={cnState(commandItemClassName, className)}
      // oxlint-disable-next-line jsx-a11y/anchor-has-content, jsx-a11y/control-has-associated-label -- the command's children fill it
      render={render ?? <a href={href} />}
      onSelect={select}
      data-value={props.value}
      {...mergeProps({ ref, href, target, rel, download }, props)}
    />
  )
}

const groupLabelClass = "px-inset-item py-inline text-xs font-medium text-muted-foreground"

type CommandRowsProps<Item extends CommandDataItem> = {
  /** The commands to show: `CommandList`'s `state.items`, with `items` passed to `Command`. */
  items: CommandData
  /** What a command shows. Its label by default. */
  children?: (item: Item) => ReactNode
  /** `"auto"` renders only the commands in view past 50; `true` always, `false` never. */
  virtualize?: Virtualize
  /** A command's height in px before it's measured, for rows taller than `h-control-sm`. Keep it stable. */
  estimateItemSize?: (item: Item) => number | undefined
}

/**
 * Renders the commands of `Command`'s `items` as styled `CommandItem`s. Past 50 commands only those in view mount,
 * with the highlighted one, so a long palette opens on the next frame; typing, the arrow keys and agents still reach
 * every command through the data. Groups keep their labels, as plain text in a long list.
 */
function CommandRows<Item extends CommandDataItem = CommandDataItem>({
  items,
  children,
  virtualize = "auto",
  estimateItemSize,
}: CommandRowsProps<Item>) {
  const highlight = use(HighlightContext)
  const { rows, anchor, virtual, ready } = useCommandRows<Item>(items, highlight, virtualize, estimateItemSize)
  if (!ready) return null
  const command = (row: CommandRowData<Item>, at: number) => (
    <CommandRow key={row.key} row={row} at={at} measure={virtual.measureElement} render={children} />
  )
  if (!virtual.enabled) {
    const out: ReactNode[] = []
    const groups = new Map<string, ReactNode[]>()
    for (const [at, row] of rows.entries()) {
      if (row.type === "separator") out.push(<CommandSeparator key={row.key} />)
      else if (row.type === "item")
        (row.group === undefined ? out : (groups.get(row.group) ?? out)).push(command(row, at))
      else {
        const members: ReactNode[] = []
        groups.set(row.key, members)
        out.push(
          <CommandGroup key={row.key}>
            {row.label && <CommandGroupLabel>{row.label}</CommandGroupLabel>}
            {members}
          </CommandGroup>,
        )
      }
    }
    return out
  }
  return (
    <div ref={anchor} role="presentation" data-slot="command-rows">
      {virtual.segments.map((segment) => {
        if (segment.type === "gap")
          return <div key={segment.key} aria-hidden="true" data-slot="command-gap" style={{ height: segment.size }} />
        const row = rows[segment.index]
        return row ? command(row, segment.index) : null
      })}
    </div>
  )
}

const commandProps = ({ value, label, keywords, disabled, shortcut }: CommandDataItem) => ({
  value,
  label,
  keywords,
  disabled,
  shortcut,
})

type CommandRowProps<Item extends CommandDataItem> = {
  row: CommandRowData<Item>
  at: number
  measure: ((node: HTMLElement | null) => (() => void) | undefined) | undefined
  render: ((item: Item) => ReactNode) | undefined
}

// Memoized: moving the highlight or scrolling renders only the rows that come into view.
const CommandRow = memo(function CommandRow<Item extends CommandDataItem>(props: CommandRowProps<Item>) {
  const { row, at, measure, render } = props
  if (row.type === "separator")
    return (
      <div ref={measure} data-index={at} role="presentation" className="py-inline">
        <div className="-mx-inline h-px bg-border" />
      </div>
    )
  if (row.type === "group")
    return (
      <div ref={measure} data-index={at} role="presentation" className={row.first ? undefined : "pt-inline"}>
        {row.label && (
          <div data-slot="command-group-label" className={groupLabelClass}>
            {row.label}
          </div>
        )}
      </div>
    )
  return (
    <CommandItem ref={measure} data-index={at} {...commandProps(row.item)} index={row.index}>
      {render?.(row.item) ?? <CommandItemText />}
    </CommandItem>
  )
}) as <Item extends CommandDataItem>(props: CommandRowProps<Item>) => ReactNode

function CommandItemIcon({ className, ...props }: ComponentProps<typeof CommandItemIconPrimitive>) {
  return (
    <CommandItemIconPrimitive
      className={cnState(
        "inline-flex text-muted-foreground in-data-highlighted:text-current data-mirror:rtl:-scale-x-100",
        className,
      )}
      {...props}
    />
  )
}

function CommandSeparator({ className, ...props }: ComponentProps<typeof CommandSeparatorPrimitive>) {
  return <CommandSeparatorPrimitive className={cnState("-mx-inline my-inline h-px bg-border", className)} {...props} />
}

/** A line under the list, for hints like the keys that move and close. Plain content, not a control. */
function CommandFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="command-footer"
      className={cn(
        "flex flex-wrap items-center gap-x-group gap-y-inline border-t px-control-x py-inset-item text-caption text-muted-foreground",
        className,
      )}
      {...props}
    />
  )
}

function CommandShortcut({ className, ...props }: ComponentProps<typeof CommandShortcutPrimitive>) {
  return (
    <CommandShortcutPrimitive
      render={<Kbd />}
      className={cnState("ms-auto empty:hidden in-data-highlighted:bg-background", className)}
      {...props}
    />
  )
}

export {
  Command,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandGroupLabel,
  CommandHostContext,
  CommandInput,
  CommandItem,
  CommandItemIcon,
  CommandItemText,
  CommandList,
  CommandPage,
  CommandRows,
  CommandSeparator,
  CommandShortcut,
  CommandStatus,
  COMMAND_VIRTUALIZE_THRESHOLD,
  createCommandController,
}
export type { CommandData, CommandDataItem, CommandHost, CommandItemFollowDetails, CommandItemProps, CommandProps }
