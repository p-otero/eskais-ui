import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// The theme's spacing tokens, so a consumer's `gap-4` or `h-10` replaces `gap-items` or `h-control` instead of
// both landing in the class list.
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

export { cn, cnState }
export type { StateClassName }
