import type { ComponentProps, MouseEvent, ReactNode, RefObject } from "react"

import { cn } from "@/lib/utils"

type SkipLinkProps = Omit<ComponentProps<"a">, "children" | "target"> & {
  /** The link text, in the page's language, like "Skip to content". */
  children: ReactNode
  /**
   * The element to focus: an id, or a ref. Defaults to the id in `href`, then `"main"`.
   * Activating the link focuses it and scrolls it into view without changing the URL, so hash routers keep their route.
   */
  target?: string | RefObject<HTMLElement | null>
}

// A document or a shadow root; a detached link is its own root, which has no ids to search.
function findsById(root: Node): root is Document | ShadowRoot {
  return "getElementById" in root
}

function resolveTarget(target: SkipLinkProps["target"], link: HTMLAnchorElement) {
  if (typeof target !== "string") return target?.current ?? null
  const root = link.getRootNode()
  return (findsById(root) ? root.getElementById(target) : null) ?? link.ownerDocument.getElementById(target)
}

function focusTarget(element: HTMLElement) {
  element.focus({ preventScroll: true })
  if (element.ownerDocument.activeElement === element) return true
  if (element.hasAttribute("tabindex")) return false
  element.tabIndex = -1
  element.focus({ preventScroll: true })
  if (element.ownerDocument.activeElement === element) return true
  element.removeAttribute("tabindex")
  return false
}

function SkipLink({ href, target, onClick, className, children, ...props }: SkipLinkProps) {
  const id = target ?? (href?.startsWith("#") && href.length > 1 ? href.slice(1) : "main")
  const resolvedHref = href ?? (typeof id === "string" ? `#${id}` : "#main")

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (event.defaultPrevented || event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const element = resolveTarget(id, event.currentTarget)
    if (!element || !focusTarget(element)) return
    event.preventDefault()
    element.scrollIntoView({ block: "start" })
  }

  return (
    <a
      data-slot="skip-link"
      href={resolvedHref}
      onClick={handleClick}
      className={cn(
        "sr-only rounded-control border border-floating-border bg-popover px-control-x text-sm font-medium text-popover-foreground shadow-floating outline-none focus:not-sr-only focus:fixed focus:start-floating focus:top-floating focus:z-toast focus:inline-flex focus:h-control focus:items-center focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
      {...props}
    >
      {children}
    </a>
  )
}

export { SkipLink }
export type { SkipLinkProps }
