import type { ComponentProps, CSSProperties, ReactNode } from "react"
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react"

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
import { ScrollArea, ScrollAreaScrollbar, ScrollAreaViewport } from "@/components/ui/scroll-area"
import { cn, cssVars } from "@/lib/utils"
import { DocsToc, useTocItems, type DocsTocItem, type DocsTocProps } from "@/components/ui/docs-toc"

type DocsLayoutProps = ComponentProps<"div"> & {
  /**
   * A Topbar across the top, usually with a SidebarTrigger in `leading`. The sidebar, the table of contents and
   * anchor scrolling start below it (`--topbar-height`).
   */
  topbar?: ReactNode
  /**
   * Usually a Sidebar with `trigger={false}` and the same controller as the topbar's SidebarTrigger. It sticks under
   * the topbar at the full remaining height and scrolls on its own; on narrow screens it's the Sidebar's drawer.
   */
  sidebar?: ReactNode
  /** Usually a DocsToc; sticky beside the content on extra-wide screens. */
  toc?: ReactNode
  /** Above the page in the main column, like a DocsBreadcrumb. It scrolls with the page. */
  header?: ReactNode
  /** The `<main>` landmark's id, a SkipLink's target. */
  mainId?: string
  /** `div` when the page already has its `<main>`, like a preview inside another page. */
  as?: "main" | "div"
}

/**
 * A documentation page: a topbar, a sidebar under it, the main column with a breadcrumb above the page, and a table
 * of contents. Without a `topbar`, pass `--docs-top` in `style` for the height of anything fixed above it, like a
 * floating site header. `--docs-sidebar-width` resizes the sidebar, and `--docs-height` (the viewport by default) is the
 * height of the box that scrolls the page, for a layout inside a pane.
 */
// Derived below the root, where a consumer's `--docs-top`, `--docs-height` and `--docs-sidebar-width` are set.
const columns = cssVars({
  "--docs-column-height": "calc(var(--docs-height) - var(--docs-top))",
  "--docs-scroll-margin": "calc(var(--docs-top) + var(--gap-group))",
})
const sidebarWidth = cssVars({ "--sidebar-width": "var(--docs-sidebar-width)" })

function DocsLayout({
  topbar,
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
  const top = topbar === undefined ? "0px" : "var(--topbar-height)"
  return (
    <div
      data-slot="docs-layout"
      className={cn("flex w-full min-w-0 flex-1 flex-col", className)}
      style={
        {
          "--docs-sidebar-width": "var(--sidebar-width)",
          "--docs-top": top,
          "--docs-height": "100dvh",
          ...style,
        } as CSSProperties
      }
      {...props}
    >
      {topbar}
      <div
        data-slot="docs-layout-body"
        className="flex min-w-0 flex-1 items-start narrow:flex-col narrow:items-stretch"
        style={columns}
      >
        {sidebar !== undefined && (
          // With a topbar, its SidebarTrigger opens the drawer on narrow screens, so this box steps aside. Without
          // one, it's the row that holds the Sidebar's own drawer button above the page.
          <div
            data-slot="docs-layout-sidebar"
            style={sidebarWidth}
            className={cn(
              "sticky top-(--docs-top) flex h-(--docs-column-height) shrink-0 narrow:static narrow:h-auto",
              topbar === undefined ? "narrow:px-group narrow:pt-inline" : "narrow:contents",
            )}
          >
            {sidebar}
          </div>
        )}
        <div
          data-slot="docs-layout-columns"
          className="mx-auto flex w-full max-w-6xl min-w-0 flex-1 gap-section px-section pt-group pb-section narrow:px-group"
        >
          <div data-slot="docs-layout-main" className="flex min-w-0 flex-1 flex-col gap-group">
            {header !== undefined && (
              <div data-slot="docs-layout-header" className="flex min-w-0">
                {header}
              </div>
            )}
            <PageLayout
              as={as}
              id={as === "main" ? mainId : undefined}
              width="full"
              // Anchors, focus and scrollIntoView all stop below the topbar, whatever the page scrolls to.
              className="min-w-0 flex-1 p-0 narrow:p-0 **:scroll-mt-(--docs-scroll-margin)"
            >
              {children}
            </PageLayout>
          </div>
          {toc !== undefined && (
            <ScrollArea className="sticky! top-(--docs-top) hidden max-h-(--docs-column-height) w-52 shrink-0 flex-col self-start xl:flex">
              <ScrollAreaViewport
                className="h-auto min-h-0 flex-1 pt-group pb-section"
                render={(part) => <div {...part} data-slot="docs-layout-toc" />}
              >
                {toc}
              </ScrollAreaViewport>
              <ScrollAreaScrollbar data-agent-hidden="" />
            </ScrollArea>
          )}
        </div>
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
  const Icon = direction === "previous" ? ArrowLeftIcon : ArrowRightIcon
  return <Icon className="size-3.5 rtl:-scale-x-100" />
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
  /**
   * From the top level down; the last item is the current page. Give every other item an `href`, and `onFollow`
   * to route on the client: an item without `href` renders as plain text that can't be followed.
   */
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
