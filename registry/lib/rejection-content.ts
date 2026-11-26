import { isValidElement, type ReactNode } from "react"

/** The text for a failure that isn't a string or a node, or a function of the failure that picks one. */
type RejectionFallback = ReactNode | ((error: unknown) => ReactNode)

/** What an alert shows for a rejection: a string or a React node as it is, otherwise `fallback`, called with it when a function. */
function rejectionContent(error: unknown, fallback: RejectionFallback): ReactNode {
  if (typeof error === "string" || isValidElement(error)) return error
  return typeof fallback === "function" ? fallback(error) : fallback
}

export { rejectionContent }
export type { RejectionFallback }
