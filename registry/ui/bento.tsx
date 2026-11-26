"use client"

import { createContext, use, type ComponentProps, type ReactNode } from "react"

import { Card, CardContent, CardDescription, CardEyebrow, CardHeader, CardTitle } from "@/components/ui/card"
import { Link, type LinkProps } from "@/components/ui/link"
import { cn, cssVars } from "@/lib/utils"

const BentoColumns = createContext(6)

type BentoProps = ComponentProps<"div"> & {
  /** Columns on a wide container (64rem and up). Between 48rem and 64rem the grid has two; below, one. */
  columns?: number
}

/** Sizes itself by its container, not the viewport. */
function Bento({ columns = 6, className, style, children, ...props }: BentoProps) {
  return (
    <div data-slot="bento" className={cn("@container w-full min-w-0", className)} style={style} {...props}>
      <div
        className="grid auto-rows-auto grid-flow-row-dense grid-cols-1 gap-items @3xl:grid-cols-2 @5xl:grid-cols-(--bento-columns)"
        style={cssVars({ "--bento-columns": `repeat(${columns}, minmax(0, 1fr))` })}
      >
        <BentoColumns value={columns}>{children}</BentoColumns>
      </div>
    </div>
  )
}

type BentoTileProps = Omit<ComponentProps<"section">, "title"> & {
  /** Columns the tile spans on a wide container; it takes the full width of the two-column layout when over half. */
  span?: number
  rowSpan?: number
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  headingLevel?: 2 | 3 | 4
  /** Makes the whole tile a link named by its title; controls inside the tile stay their own targets. */
  href?: string
  onFollow?: LinkProps["onFollow"]
  children?: ReactNode
}

function BentoTile({
  span = 1,
  rowSpan = 1,
  eyebrow,
  title,
  description,
  headingLevel = 3,
  href,
  onFollow,
  className,
  style,
  children,
  ...props
}: BentoTileProps) {
  const columns = use(BentoColumns)
  const wide = Math.min(Math.max(span, 1), columns)
  const medium = wide * 2 > columns ? 2 : 1
  return (
    <Card
      data-slot="bento-tile"
      data-linked={href === undefined ? undefined : ""}
      className={cn(
        "relative col-span-1 row-span-(--bento-row-span) min-w-0 transition duration-micro ease-standard @3xl:col-span-(--bento-span-md) @5xl:col-span-(--bento-span) data-linked:hover:-translate-y-px data-linked:hover:border-input-strong",
        className,
      )}
      style={{ ...style, ...cssVars({ "--bento-span": wide, "--bento-span-md": medium, "--bento-row-span": rowSpan }) }}
      {...props}
    >
      <CardHeader>
        {eyebrow !== undefined && <CardEyebrow>{eyebrow}</CardEyebrow>}
        <CardTitle headingLevel={headingLevel}>
          {href === undefined ? (
            title
          ) : (
            <Link
              href={href}
              onFollow={onFollow}
              variant="plain"
              className="rounded-sm outline-none after:absolute after:inset-0 after:rounded-surface focus-visible:after:ring-2 focus-visible:after:ring-ring hover:underline"
            >
              {title}
            </Link>
          )}
        </CardTitle>
        {description !== undefined && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      {children !== undefined && (
        <CardContent className="relative z-10 flex min-w-0 flex-1 flex-col gap-group">{children}</CardContent>
      )}
    </Card>
  )
}

export { Bento, BentoTile }
export type { BentoProps, BentoTileProps }
