import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

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
