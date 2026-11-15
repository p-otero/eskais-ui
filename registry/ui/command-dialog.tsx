"use client"

import { DialogShortcut as DialogShortcutPrimitive } from "@ui-sdk/react/dialog"
import type { ComponentProps, ReactNode } from "react"

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

// `shortcut="mod+k"` is opt-in: the trigger registers it only while mounted, so nothing listens by default.
function CommandDialogTrigger({ className, ...props }: ComponentProps<typeof DialogTrigger>) {
  return <DialogTrigger className={cnState("justify-between gap-6 text-muted-foreground", className)} {...props} />
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
  CommandDialogShortcut,
  CommandDialogTrigger,
  createCommandDialogController,
}
export type { CommandDialogContentProps }
