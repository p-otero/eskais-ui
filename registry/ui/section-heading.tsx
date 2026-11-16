import type { ComponentProps, ReactNode } from "react"

import { cn } from "@/lib/utils"

type SectionHeadingProps = Omit<ComponentProps<"header">, "title"> & {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  /** Links or buttons beside the heading on wide containers, below it on narrow ones. */
  actions?: ReactNode
  align?: "start" | "center"
  headingLevel?: 2 | 3 | 4
  /** The heading's id, so the enclosing `<section aria-labelledby>` can name itself after it. */
  headingId?: string
}

/** The heading of a page section: eyebrow, a large title, a description and optional actions. */
function SectionHeading({
  eyebrow,
  title,
  description,
  actions,
  align = "start",
  headingLevel = 2,
  headingId,
  className,
  ...props
}: SectionHeadingProps) {
  const Heading = `h${headingLevel}` as const
  const centered = align === "center"
  return (
    <header
      data-slot="section-heading"
      data-align={align}
      className={cn(
        "@container flex w-full flex-col gap-group",
        centered ? "items-center text-center" : "@2xl:flex-row @2xl:items-end @2xl:justify-between",
        className,
      )}
      {...props}
    >
      <div className={cn("flex max-w-2xl min-w-0 flex-col gap-items", centered && "items-center")}>
        {eyebrow !== undefined && (
          <p data-slot="section-heading-eyebrow" className="text-meta tracking-meta text-muted-foreground uppercase">
            {eyebrow}
          </p>
        )}
        <Heading
          id={headingId}
          data-slot="section-heading-title"
          className="text-3xl font-semibold tracking-tight text-balance @xl:text-4xl"
        >
          {title}
        </Heading>
        {description !== undefined && (
          <p data-slot="section-heading-description" className="text-body text-pretty text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions !== undefined && (
        <div data-slot="section-heading-actions" className="flex shrink-0 flex-wrap items-center gap-items">
          {actions}
        </div>
      )}
    </header>
  )
}

export { SectionHeading }
export type { SectionHeadingProps }
