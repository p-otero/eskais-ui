"use client"

import { useState, type ReactNode } from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuGroupLabel,
  DropdownMenuItem,
  DropdownMenuItemIcon,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Tone } from "@/lib/tone"
import { cn } from "@/lib/utils"

type AccountUser = {
  name: string
  email?: string
  /** The avatar's image; the initials show until it loads, and instead of it when it fails. */
  avatarSrc?: string
  /** Two letters from `name` by default. */
  initials?: string
}

type AccountMenuItem = {
  value: string
  label: ReactNode
  /** A lucide icon element, like `<MonitorSmartphoneIcon />`. */
  icon?: ReactNode
  /** Runs when the item is chosen; a returned Promise keeps it pending and the menu open until it settles. */
  onSelect?: () => unknown
  disabled?: boolean
}

type AccountMenuSignOutConfirm = {
  title: ReactNode
  description?: ReactNode
  confirmLabel: ReactNode
  /** What a person approves when an agent signs out, like "Signs you out of this device". */
  agentConfirm: string
  cancelLabel?: ReactNode
}

type AccountMenuLabels = {
  /** Names the trigger, from the user's name, so the visible name stays part of it. */
  trigger: (name: string) => string
}

const accountMenuLabels: AccountMenuLabels = {
  trigger: (name) => `Account: ${name}`,
}

type AccountMenuProps = {
  user: AccountUser
  /** The user's role, as a Badge in the menu's header. */
  roleLabel?: ReactNode
  roleTone?: Tone
  /** App entries above sign-out, like Devices, Security or Invite. */
  items?: readonly AccountMenuItem[]
  signOutLabel: ReactNode
  /** Signs out; a returned Promise keeps the item, or the confirmation, pending until it settles. */
  onSignOut: () => unknown
  /** Asks before signing out; the confirm button then needs a person's approval for an agent. */
  confirmSignOut?: AccountMenuSignOutConfirm
  labels?: Partial<AccountMenuLabels>
  className?: string
}

const noItems: readonly AccountMenuItem[] = []

function initialsOf(name: string) {
  const words = name.trim().split(/\s+/u).filter(Boolean)
  const letters = words.length > 1 ? [words[0], words.at(-1)] : [words[0]]
  return letters
    .map((word) => (word === undefined ? "" : (Array.from(word)[0] ?? "")))
    .join("")
    .toLocaleUpperCase()
}

function AccountAvatar({ user, size }: { user: AccountUser; size: "sm" | "default" }) {
  return (
    <Avatar size={size} aria-hidden="true">
      {user.avatarSrc === undefined ? null : <AvatarImage src={user.avatarSrc} alt="" />}
      <AvatarFallback>{user.initials ?? initialsOf(user.name)}</AvatarFallback>
    </Avatar>
  )
}

function AccountMenu({
  user,
  roleLabel,
  roleTone = "neutral",
  items = noItems,
  signOutLabel,
  onSignOut,
  confirmSignOut,
  labels: overrides,
  className,
}: AccountMenuProps) {
  const labels = { ...accountMenuLabels, ...overrides }
  const [confirming, setConfirming] = useState(false)
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          variant="ghost"
          aria-label={labels.trigger(user.name)}
          className={cn("max-w-56 gap-items ps-inline narrow:pe-inline", className)}
        >
          <AccountAvatar user={user} size="sm" />
          <span data-slot="account-menu-name" className="min-w-0 truncate narrow:hidden">
            {user.name}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 max-w-(--available-width)">
          <DropdownMenuGroup>
            <DropdownMenuGroupLabel
              render={(part) => <div {...part} data-slot="account-menu-header" />}
              className="flex items-center gap-items px-inset-item py-inset-item text-body-sm font-normal text-foreground"
            >
              <AccountAvatar user={user} size="default" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">{user.name}</span>
                {user.email === undefined ? null : (
                  <span className="truncate text-caption text-muted-foreground">{user.email}</span>
                )}
              </span>
              {roleLabel === undefined ? null : (
                <Badge data-slot="account-menu-role" tone={roleTone} className="shrink-0">
                  {roleLabel}
                </Badge>
              )}
            </DropdownMenuGroupLabel>
            {items.map((item) => (
              <DropdownMenuItem
                key={item.value}
                value={item.value}
                disabled={item.disabled}
                onSelect={() => item.onSelect?.()}
              >
                {item.icon === undefined ? null : <DropdownMenuItemIcon>{item.icon}</DropdownMenuItemIcon>}
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            value="sign-out"
            onSelect={() => {
              if (!confirmSignOut) return onSignOut()
              setConfirming(true)
              return undefined
            }}
          >
            {signOutLabel}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {confirmSignOut === undefined ? null : (
        <ConfirmDialog
          open={confirming}
          onOpenChange={setConfirming}
          title={confirmSignOut.title}
          description={confirmSignOut.description}
          confirmLabel={confirmSignOut.confirmLabel}
          agentConfirm={confirmSignOut.agentConfirm}
          labels={confirmSignOut.cancelLabel === undefined ? undefined : { cancel: confirmSignOut.cancelLabel }}
          onConfirm={() => onSignOut()}
        />
      )}
    </>
  )
}

export { AccountMenu, accountMenuLabels }
export type { AccountMenuItem, AccountMenuLabels, AccountMenuProps, AccountMenuSignOutConfirm, AccountUser }
