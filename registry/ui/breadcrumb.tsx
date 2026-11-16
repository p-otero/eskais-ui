import { renderElement, type PartProps } from "@ui-sdk/react/primitive"
import { ChevronRightIcon } from "lucide-react"

import { Link, type LinkProps } from "@/components/ui/link"
import { cn } from "@/lib/utils"

function Breadcrumb({ render, "aria-label": label = "Breadcrumb", ...props }: PartProps<"nav">) {
  return renderElement("nav", { "data-slot": "breadcrumb", "aria-label": label, ...props }, render)
}

function BreadcrumbList({ className, render, ...props }: PartProps<"ol">) {
  return renderElement(
    "ol",
    {
      "data-slot": "breadcrumb-list",
      className: cn(
        "m-0 flex list-none flex-wrap items-center gap-inline p-0 text-sm break-words text-muted-foreground",
        className,
      ),
      ...props,
    },
    render,
  )
}

function BreadcrumbItem({ className, render, ...props }: PartProps<"li">) {
  return renderElement(
    "li",
    { "data-slot": "breadcrumb-item", className: cn("inline-flex items-center gap-inline", className), ...props },
    render,
  )
}

function BreadcrumbLink({ className, variant = "nav", ...props }: LinkProps) {
  return (
    <Link data-slot="breadcrumb-link" variant={variant} className={cn("hover:text-foreground", className)} {...props} />
  )
}

function BreadcrumbPage({ className, render, ...props }: PartProps<"span">) {
  return renderElement(
    "span",
    {
      "data-slot": "breadcrumb-page",
      "aria-current": "page",
      className: cn("font-medium text-foreground", className),
      ...props,
    },
    render,
  )
}

function BreadcrumbSeparator({ className, children, render, ...props }: PartProps<"li">) {
  return renderElement(
    "li",
    {
      "data-slot": "breadcrumb-separator",
      role: "presentation",
      "aria-hidden": true,
      className: cn("inline-flex [&>svg]:size-3.5 rtl:[&>svg]:-scale-x-100", className),
      children: children ?? <ChevronRightIcon />,
      ...props,
    },
    render,
  )
}

function BreadcrumbEllipsis({ className, render, ...props }: PartProps<"span">) {
  return renderElement(
    "span",
    {
      "data-slot": "breadcrumb-ellipsis",
      "aria-hidden": true,
      className: cn("inline-flex size-5 items-center justify-center", className),
      children: "…",
      ...props,
    },
    render,
  )
}

export {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
}
