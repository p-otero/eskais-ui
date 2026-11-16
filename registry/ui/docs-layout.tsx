import type { ComponentProps, CSSProperties, ReactNode } from "react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Link, type LinkProps } from "@/components/ui/link"
import { PageLayout } from "@/components/ui/page-layout"
import { ScrollArea, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaViewport } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { DocsToc, useTocItems, type DocsTocItem, type DocsTocProps } from "@/components/ui/docs-toc"

type DocsLayoutProps = ComponentProps<"div"> & {
  /** Usually a Sidebar. Fixed beside the content on wide screens; in the header row on narrow ones. */
  sidebar?: ReactNode
  /** Usually a DocsToc; shown beside the content on extra-wide screens. */
  toc?: ReactNode
  /** A bar that sticks above the content, like a DocsBreadcrumb; on narrow screens the sidebar's trigger joins it. */
  header?: ReactNode
  /** The `<main>` landmark's id, a SkipLink's target. */
  mainId?: string
  /** `div` when the page already has its `<main>`, like a preview inside another page. */
  as?: "main" | "div"
}

/**
 * A documentation page: sidebar, main column, table of contents and a sticky header. Pass `--docs-top` in `style` for
 * the height of anything fixed above it (a site header), and `--docs-sidebar-width` to resize the sidebar.
 */
function DocsLayout({
  sidebar,
  toc,
  header,
  mainId = "main",
  as = "main",
  className,
  style,
  children,
  ...props
}: DocsLayoutProps) {
  return (
    <div
      data-slot="docs-layout"
      className={cn(
        "flex w-full min-w-0 flex-1 flex-col",
        sidebar !== undefined && "ps-(--docs-sidebar-width) narrow:ps-0",
        className,
      )}
      style={{ "--docs-sidebar-width": "16rem", "--docs-top": "0px", ...style } as CSSProperties}
      {...props}
    >
      {(sidebar !== undefined || header !== undefined) && (
        <div
          data-slot="docs-layout-header"
          className="sticky top-(--docs-top) z-sticky flex min-w-0 items-center gap-inline bg-background narrow:px-group empty:hidden"
        >
          {sidebar !== undefined && (
            <div
              data-slot="docs-layout-sidebar"
              className="fixed start-0 top-(--docs-top) bottom-0 flex w-(--docs-sidebar-width) narrow:static narrow:w-auto"
            >
              <ScrollArea className="flex-1 narrow:overflow-visible">
                <ScrollAreaViewport className="narrow:overflow-visible">{sidebar}</ScrollAreaViewport>
                <ScrollAreaScrollbar orientation="vertical">
                  <ScrollAreaThumb />
                </ScrollAreaScrollbar>
              </ScrollArea>
            </div>
          )}
          {header !== undefined && (
            <div className="mx-auto flex w-full max-w-6xl min-w-0 px-section py-inline narrow:px-0">{header}</div>
          )}
        </div>
      )}
      <div className="mx-auto flex w-full max-w-6xl min-w-0 gap-section px-section pt-group pb-section narrow:px-group">
        <PageLayout
          as={as}
          id={as === "main" ? mainId : undefined}
          width="full"
          className="min-w-0 flex-1 p-0 narrow:p-0"
        >
          {children}
        </PageLayout>
        {toc !== undefined && (
          <div
            data-slot="docs-layout-toc"
            className="sticky top-(--docs-top) hidden w-52 shrink-0 self-start pt-group xl:block"
          >
            {toc}
          </div>
        )}
      </div>
    </div>
  )
}

type DocsPagerLink = Omit<LinkProps, "children" | "variant" | "title"> & { href: string; title: ReactNode }

type DocsPagerLabels = { navigation: string; previous: string; next: string }

type DocsPagerProps = Omit<ComponentProps<"nav">, "children"> & {
  previous?: DocsPagerLink
  next?: DocsPagerLink
  labels?: Partial<DocsPagerLabels>
}

const pagerCard =
  "group flex min-w-0 flex-1 flex-col gap-inline rounded-surface border bg-card px-inset-item py-inset-item outline-none transition-colors duration-micro ease-standard hover:border-input-strong focus-visible:ring-2 focus-visible:ring-ring"

function Arrow({ direction }: { direction: "previous" | "next" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
      className="size-3.5 rtl:-scale-x-100"
    >
      <path d={direction === "previous" ? "M19 12H5m6 6-6-6 6-6" : "M5 12h14m-6-6 6 6-6 6"} />
    </svg>
  )
}

/** Links to the previous and next pages, as two cards. */
function DocsPager({ previous, next, labels: overrides, className, ...props }: DocsPagerProps) {
  const labels = { navigation: "Previous and next pages", previous: "Previous", next: "Next", ...overrides }
  return (
    <nav
      data-slot="docs-pager"
      aria-label={labels.navigation}
      className={cn("flex gap-items border-t pt-group narrow:flex-col", className)}
      {...props}
    >
      {previous ? (
        <Link variant="plain" className={pagerCard} {...previous} title={undefined}>
          <span className="flex items-center gap-inline text-caption text-muted-foreground">
            <Arrow direction="previous" />
            {labels.previous}
          </span>
          <span className="truncate text-title-sm">{previous.title}</span>
        </Link>
      ) : (
        <span className="flex-1 narrow:hidden" />
      )}
      {next ? (
        <Link variant="plain" className={cn(pagerCard, "items-end text-end")} {...next} title={undefined}>
          <span className="flex items-center gap-inline text-caption text-muted-foreground">
            {labels.next}
            <Arrow direction="next" />
          </span>
          <span className="max-w-full truncate text-title-sm">{next.title}</span>
        </Link>
      ) : (
        <span className="flex-1 narrow:hidden" />
      )}
    </nav>
  )
}

type DocsBreadcrumbItem = Omit<LinkProps, "children" | "variant"> & { label: ReactNode; href?: string }

type DocsBreadcrumbProps = Omit<ComponentProps<typeof Breadcrumb>, "children"> & {
  /** From the top level down; the last item is the current page. */
  items: readonly DocsBreadcrumbItem[]
}

function DocsBreadcrumb({ items, ...props }: DocsBreadcrumbProps) {
  return (
    <Breadcrumb data-slot="docs-breadcrumb" {...props}>
      <BreadcrumbList className="flex-nowrap text-body-sm">
        {items.map(({ label, href, ...link }, index) => {
          const last = index === items.length - 1
          return [
            index > 0 && <BreadcrumbSeparator key={`separator-${String(href ?? index)}`} />,
            <BreadcrumbItem key={String(href ?? index)} className={cn(last ? "min-w-0" : "shrink-0")}>
              {last ? (
                <BreadcrumbPage className="truncate">{label}</BreadcrumbPage>
              ) : href === undefined ? (
                <span>{label}</span>
              ) : (
                <BreadcrumbLink href={href} {...link}>
                  {label}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>,
          ]
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

export { DocsBreadcrumb, DocsLayout, DocsPager }
export { DocsToc, useTocItems }
export type { DocsBreadcrumbItem, DocsBreadcrumbProps, DocsLayoutProps, DocsPagerLabels, DocsPagerLink, DocsPagerProps }
export type { DocsTocItem, DocsTocProps }
