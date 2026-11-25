import { clsx, type ClassValue } from "clsx"
import type { CSSProperties } from "react"
import { extendTailwindMerge } from "tailwind-merge"

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      spacing: [
        "inline",
        "items",
        "group",
        "section",
        "inset-chip",
        "inset-item",
        "inset-surface",
        "surface",
        "control",
        "control-sm",
        "control-lg",
        "control-x",
        "control-inset",
      ],
      text: ["meta", "caption", "body-sm", "body", "title-sm", "title", "display-sm", "display", "entry"],
      radius: ["control", "choice", "surface", "floating"],
      shadow: ["surface", "floating"],
      tracking: ["meta", "tight"],
      ease: ["standard"],
    },
    classGroups: {
      z: [{ z: ["sticky", "overlay", "popover", "toast"] }],
      duration: [{ duration: ["micro", "panel", "dialog"] }],
    },
  },
})

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

type StateClassName<State> = string | ((state: State) => string | undefined) | undefined

/** Merges base classes with a UI SDK `className`, which may be a function of the part's state. */
function cnState<State>(base: string, className: StateClassName<State>) {
  if (typeof className === "function") return (state: State) => cn(base, className(state))
  return cn(base, className)
}

/** CSS custom properties for a `style` prop, typed without a cast: `style={cssVars({ "--lanes": 3 })}`. */
function cssVars(variables: Record<`--${string}`, string | number | undefined>): CSSProperties {
  return variables
}

export { cn, cnState, cssVars }
export type { StateClassName }
