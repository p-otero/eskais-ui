import type { ComponentProps, ReactNode } from "react"

import { cn } from "@/lib/utils"

type SkipLinkProps = Omit<ComponentProps<"a">, "children"> & {
  /** The link text, in the page's language, like "Skip to content". */
  children: ReactNode
}

// Fixed, not absolute, so it shows at the top of the viewport wherever the page is scrolled when it takes focus.
function SkipLink({ href = "#main", className, children, ...props }: SkipLinkProps) {
  return (
    <a
      data-slot="skip-link"
      href={href}
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
