"use client"

import { DialogShortcut as DialogShortcutPrimitive, type DialogController } from "@ui-sdk/react/dialog"
import type { ComponentProps, ReactNode } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog as CommandDialog,
  DialogBackdrop,
  DialogContent,
  DialogTitle,
  DialogTrigger,
  createDialogController as createCommandDialogController,
} from "@/components/ui/dialog"
import { Kbd } from "@/components/ui/kbd"
import { cnState } from "@/lib/utils"

/** What `createCommandDialogController()` returns, to pass between the Topbar's triggers and the dialog. */
type CommandDialogController = DialogController

// `shortcut="mod+k"` is opt-in: the trigger registers it only while mounted, so nothing listens by default.
function CommandDialogTrigger({ className, ...props }: ComponentProps<typeof DialogTrigger>) {
  return <DialogTrigger className={cnState("justify-between gap-group text-muted-foreground", className)} {...props} />
}

type CommandDialogOpenButtonProps = ComponentProps<typeof Button> & {
  /** The CommandDialog's controller, from `createCommandDialogController()`. */
  controller: { open: () => unknown }
}

// A second CommandDialogTrigger on the same controller makes UI SDK 0.1.0-beta.5 drop the dialog's agent label
// (docs/research/08-command-dialog-second-trigger.md). This one opens through the controller and stays hidden from
// agents, who use the main trigger.
/** Another way for people to open a CommandDialog, like a Topbar's `centerCompact` icon. Name it with `aria-label`. */
function CommandDialogOpenButton({ controller, ...props }: CommandDialogOpenButtonProps) {
  return <Button aria-haspopup="dialog" data-agent-hidden="" onClick={() => controller.open()} {...props} />
}

function CommandDialogShortcut({ className, ...props }: ComponentProps<typeof DialogShortcutPrimitive>) {
  return <DialogShortcutPrimitive render={<Kbd />} className={cnState("empty:hidden", className)} {...props} />
}

type CommandDialogContentProps = ComponentProps<typeof DialogContent> & {
  title?: ReactNode
}

function CommandDialogContent({ className, children, title = "Command palette", ...props }: CommandDialogContentProps) {
  return (
    <>
      <DialogBackdrop />
      <DialogContent className={cnState("max-w-xl gap-0 overflow-hidden p-0", className)} {...props}>
        {(state) => (
          <>
            <DialogTitle className="sr-only">{title}</DialogTitle>
            {typeof children === "function" ? children(state) : children}
          </>
        )}
      </DialogContent>
    </>
  )
}

export {
  CommandDialog,
  CommandDialogContent,
  CommandDialogOpenButton,
  CommandDialogShortcut,
  CommandDialogTrigger,
  createCommandDialogController,
}
export type { CommandDialogContentProps, CommandDialogController, CommandDialogOpenButtonProps }
