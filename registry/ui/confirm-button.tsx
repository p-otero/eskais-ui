"use client"

import { createParts } from "@ui-sdk/react/primitive"
import type { ComponentProps, ReactNode } from "react"

import { buttonVariants } from "@/components/ui/button"
import {
  confirmButton,
  type ConfirmButtonArmedChangeReason,
  type ConfirmButtonConfirmReason,
  type ConfirmButtonOptions,
} from "@/components/ui/confirm-button-primitive"
import { Spinner } from "@/components/ui/spinner"
import { cn, cnState, cssVars } from "@/lib/utils"

const { Root: ConfirmButtonRoot } = createParts(confirmButton, { root: "button" })

type ConfirmButtonLabels = {
  /** The button's text and name while armed, and what a screen reader hears when it arms. */
  armed: string
  /** Describes a button with `hold`: a second press or a hold confirms. */
  holdHint: string
}

const confirmButtonLabels: ConfirmButtonLabels = {
  armed: "Press again to confirm",
  holdHint: "Press twice, or press and hold, to confirm",
}

type ConfirmButtonProps = Omit<ComponentProps<typeof ConfirmButtonRoot>, "children" | "armedAnnouncement"> & {
  /** What the button does, said to an agent's person before it runs: it becomes `data-agent-confirm`. */
  agentConfirm: string
  /** The idle content, which names the button. */
  children: ReactNode
  /** The content while armed. Defaults to `labels.armed`; it names the button then, so keep it text. */
  armedChildren?: ReactNode
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost"
  size?: "sm" | "default" | "lg"
  labels?: Partial<ConfirmButtonLabels>
}

const idleAndArmedInOneCell =
  "grid items-center justify-items-center *:col-start-1 *:row-start-1 *:inline-flex *:items-center *:gap-inline"

/**
 * The first press arms it (`data-armed`, its text becomes `labels.armed`), the second runs `onConfirm`. It disarms after `timeout`, on Escape or when focus leaves, each with its reason in `onArmedChange`.
 * With `hold`, holding it that long confirms too. Agents call `confirm`, which waits for a person through `allow`.
 */
function ConfirmButton({
  agentConfirm,
  children,
  armedChildren,
  variant = "destructive",
  size = "default",
  labels: ownLabels,
  hold,
  className,
  style,
  ...props
}: ConfirmButtonProps) {
  const labels = { ...confirmButtonLabels, ...ownLabels }
  const holdStyle = hold ? cssVars({ "--confirm-hold-duration": `${String(hold)}ms` }) : undefined
  return (
    <ConfirmButtonRoot
      data-agent-confirm={agentConfirm}
      hold={hold}
      armedAnnouncement={labels.armed}
      title={hold ? labels.holdHint : undefined}
      style={{ ...holdStyle, ...style }}
      className={cnState(
        cn(
          buttonVariants({ variant, size }),
          "group/confirm relative overflow-hidden data-armed:bg-destructive data-armed:text-destructive-foreground data-armed:hover:bg-destructive/90",
        ),
        className,
      )}
      {...props}
    >
      {(state) => (
        <>
          {hold ? (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 origin-left scale-x-0 bg-current opacity-20 group-data-holding/confirm:scale-x-100 group-data-holding/confirm:transition-transform group-data-holding/confirm:duration-(--confirm-hold-duration) group-data-holding/confirm:ease-linear rtl:origin-right"
            />
          ) : null}
          <span className={idleAndArmedInOneCell}>
            <span aria-hidden={state.armed || undefined} className={state.armed ? "invisible" : undefined}>
              {state.pending ? <Spinner size="sm" /> : null}
              {children}
            </span>
            <span aria-hidden={!state.armed || undefined} className={state.armed ? undefined : "invisible"}>
              {armedChildren ?? labels.armed}
            </span>
          </span>
        </>
      )}
    </ConfirmButtonRoot>
  )
}

export { ConfirmButton, confirmButtonLabels }
export type { ConfirmButtonLabels, ConfirmButtonProps }
export type { ConfirmButtonArmedChangeReason, ConfirmButtonConfirmReason, ConfirmButtonOptions }
