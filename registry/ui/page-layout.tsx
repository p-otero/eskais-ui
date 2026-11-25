import { cva } from "class-variance-authority"
import type { ComponentProps, ReactNode } from "react"

import { cn } from "@/lib/utils"

type PageWidth = "dense" | "wide" | "full"

const pageLayoutVariants = cva("flex w-full min-w-0 flex-col", {
  variants: {
    variant: {
      default: "items-center px-section py-section narrow:px-group narrow:py-group",
      workspace: "min-h-0 flex-1",
    },
  },
  defaultVariants: { variant: "default" },
})

const pageContentVariants = cva("flex w-full min-w-0 flex-col", {
  variants: {
    variant: { default: "gap-section", workspace: "min-h-0 flex-1" },
    width: { dense: "max-w-295", wide: "max-w-360", full: "" },
  },
  defaultVariants: { variant: "default", width: "dense" },
})

type PageLayoutProps = Omit<ComponentProps<"div">, "title"> & {
  /** `dense` caps the content at 73.75rem, `wide` at 90rem, `full` has no cap. Ignored by the workspace variant. */
  width?: PageWidth
  /** `workspace` drops the padding and the cap for app-like screens that lay out their own panes. */
  variant?: "default" | "workspace"
  /** Usually a PageHeader. It comes first, in the same column as the content. */
  header?: ReactNode
  /**
   * `main` renders the `<main>` landmark, with `id="main"` unless you pass one, so a SkipLink's default `#main` reaches it.
   * Leave it as `div` when the app shell already renders `<main>`: a page has only one.
   */
  as?: "div" | "main"
}

function PageLayout({
  width = "dense",
  variant = "default",
  header,
  as = "div",
  id,
  className,
  children,
  ...props
}: PageLayoutProps) {
  const Element = as
  const workspace = variant === "workspace"
  // Spec: tabIndex -1 lets a skip link move focus into <main>, not only scroll to it.
  return (
    <Element
      data-slot="page-layout"
      data-variant={variant}
      data-width={workspace ? "full" : width}
      id={as === "main" ? (id ?? "main") : id}
      tabIndex={as === "main" ? -1 : undefined}
      className={cn(pageLayoutVariants({ variant }), as === "main" && "focus:outline-none", className)}
      {...props}
    >
      <div
        data-slot="page-layout-content"
        className={pageContentVariants({ variant, width: workspace ? "full" : width })}
      >
        {header}
        {children}
      </div>
    </Element>
  )
}

export { PageLayout }
export type { PageLayoutProps, PageWidth }
