import { useId, type ComponentProps, type ReactNode } from "react"

import { cn } from "@/lib/utils"

type PageHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

type PageHeaderProps = Omit<ComponentProps<"div">, "title"> & {
  title: ReactNode
  headingLevel?: PageHeadingLevel
  description?: ReactNode
  actions?: ReactNode
  breadcrumb?: ReactNode
  titleId?: string
}

function PageHeader({
  title,
  headingLevel = 1,
  description,
  actions,
  breadcrumb,
  titleId: titleIdProp,
  className,
  ...props
}: PageHeaderProps) {
  const generatedId = useId()
  const titleId = titleIdProp ?? generatedId
  const Heading = `h${headingLevel}` as const
  return (
    <div data-slot="page-header" className={cn("flex flex-col gap-2", className)} {...props}>
      {breadcrumb !== undefined && (
        <div data-slot="page-header-breadcrumb" className="text-sm text-muted-foreground">
          {breadcrumb}
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-x-surface gap-y-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Heading
            id={titleId}
            data-slot="page-header-title"
            className="text-2xl font-semibold tracking-tight text-balance"
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
          <div data-slot="page-header-actions" className="flex flex-wrap items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}

export { PageHeader }
export type { PageHeaderProps, PageHeadingLevel }
