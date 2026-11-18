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
} from "@ui-sdk/react/command"
import { mergeProps } from "@ui-sdk/react/primitive"
import { createContext, use, useCallback, useState, type ComponentProps } from "react"
import { SearchIcon } from "lucide-react"

import { isHashRoute, useFastLink } from "@/components/ui/fast-link"
import { Kbd } from "@/components/ui/kbd"
import { isPlainClick } from "@/components/ui/link-primitive"
import { cn, cnState } from "@/lib/utils"

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

/**
 * Inside a CommandDialogContent, each open starts from `defaultQuery` (empty by default), on the first page with
 * nothing highlighted, unless `query` controls the search text.
 */
function Command({ className, onQueryChange, onPagesChange, ...props }: CommandProps) {
  const host = use(CommandHostContext)
  // A closed dialog can stay mounted (keepMounted, or an exit animation that never ends), so opening remounts the
  // primitive rather than trusting the content to unmount.
  const [opens, setOpens] = useState(0)
  const [wasOpen, setWasOpen] = useState(host?.open ?? false)
  const open = host?.open ?? false
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setOpens(opens + 1)
  }
  return (
    <CommandPrimitive
      key={opens}
      className={cnState(
        "flex w-full flex-col overflow-hidden rounded-surface bg-popover/(--glass-opacity) text-popover-foreground in-data-[slot=dialog-content]:rounded-none in-data-[slot=dialog-content]:bg-transparent",
        className,
      )}
      onQueryChange={(query, details) => {
        if (!escapeClosesHost(host, details)) onQueryChange?.(query, details)
      }}
      onPagesChange={(pages, details) => {
        if (!escapeClosesHost(host, details)) onPagesChange?.(pages, details)
      }}
      {...props}
    />
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
  return (
    <CommandGroupLabelPrimitive
      className={cnState("px-inset-item py-inline text-xs font-medium text-muted-foreground", className)}
      {...props}
    />
  )
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
    return <CommandItemPrimitive className={cnState(commandItemClassName, className)} {...props} />
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
      {...mergeProps({ ref, href, target, rel, download }, props)}
    />
  )
}

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
  CommandSeparator,
  CommandShortcut,
  CommandStatus,
  createCommandController,
}
export type { CommandHost, CommandItemFollowDetails, CommandItemProps, CommandProps }
