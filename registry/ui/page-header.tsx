import { useId, type ComponentProps, type ReactNode } from "react"

import { ScrollArea, ScrollAreaScrollbar, ScrollAreaViewport } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

type PageHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

type PageHeaderProps = Omit<ComponentProps<"div">, "title"> & {
  title: ReactNode
  /** A short kicker above the title, like the section or object type. */
  eyebrow?: ReactNode
  headingLevel?: PageHeadingLevel
  description?: ReactNode
  actions?: ReactNode
  breadcrumb?: ReactNode
  /** A slot under the title row for a TabsList. Wrap the page in Tabs so the list and its panels share one root. */
  tabs?: ReactNode
  titleId?: string
}

function PageHeader({
  title,
  eyebrow,
  headingLevel = 1,
  description,
  actions,
  breadcrumb,
  tabs,
  titleId: titleIdProp,
  className,
  ...props
}: PageHeaderProps) {
  const generatedId = useId()
  const titleId = titleIdProp ?? generatedId
  const Heading = `h${headingLevel}` as const
  return (
    <div data-slot="page-header" className={cn("flex flex-col gap-items", className)} {...props}>
      {breadcrumb !== undefined && (
        <div data-slot="page-header-breadcrumb" className="text-sm text-muted-foreground">
          {breadcrumb}
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-group narrow:flex-col narrow:items-stretch">
        <div className="flex min-w-0 flex-1 flex-col gap-inline">
          {eyebrow !== undefined && (
            <p data-slot="page-header-eyebrow" className="text-meta tracking-meta text-muted-foreground uppercase">
              {eyebrow}
            </p>
          )}
          <Heading
            id={titleId}
            data-slot="page-header-title"
            className="text-display-sm tracking-tight text-balance wrap-anywhere"
          >
            {title}
          </Heading>
          {description !== undefined && (
            <p data-slot="page-header-description" className="text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions !== undefined && (
          <div data-slot="page-header-actions" className="flex flex-wrap items-center gap-items">
            {actions}
          </div>
        )}
      </div>
      {tabs !== undefined && (
        <ScrollArea className="-m-inline min-w-0">
          <ScrollAreaViewport
            className="flex h-auto p-inline"
            render={(part) => <div {...part} data-slot="page-header-tabs" />}
          >
            {tabs}
          </ScrollAreaViewport>
          <ScrollAreaScrollbar orientation="horizontal" data-agent-hidden="" />
        </ScrollArea>
      )}
    </div>
  )
}

export { PageHeader }
export type { PageHeaderProps, PageHeadingLevel }
