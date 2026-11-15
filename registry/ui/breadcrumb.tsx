import { renderElement, type PartProps } from "@ui-sdk/react/primitive"

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
        "m-0 flex list-none flex-wrap items-center gap-1.5 p-0 text-sm break-words text-muted-foreground",
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
    { "data-slot": "breadcrumb-item", className: cn("inline-flex items-center gap-1.5", className), ...props },
    render,
  )
}

function BreadcrumbLink({ className, render, ...props }: PartProps<"a">) {
  return renderElement(
    "a",
    {
      "data-slot": "breadcrumb-link",
      className: cn(
        "rounded-sm underline-offset-4 transition-colors outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      ),
      ...props,
    },
    render,
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
      children: children ?? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="m9 18 6-6-6-6" />
        </svg>
      ),
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
