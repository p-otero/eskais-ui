import type { ComponentProps, ReactNode } from "react"

import { Link, type LinkProps } from "@/components/ui/link"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

type SiteFooterLink = Omit<LinkProps, "children" | "variant"> & { label: ReactNode; href: string }

type SiteFooterGroup = {
  /** The group's heading, which also names its navigation landmark. */
  title: string
  links: readonly SiteFooterLink[]
}

type SiteFooterProps = Omit<ComponentProps<"footer">, "children"> & {
  /** The logo and name, usually a Link to the home page. */
  brand?: ReactNode
  description?: ReactNode
  groups?: readonly SiteFooterGroup[]
  /** The line under the separator: a copyright, a licence, a note. */
  bottom?: ReactNode
  /** Anything else beside the groups, like a newsletter form. */
  children?: ReactNode
}

const noGroups: readonly SiteFooterGroup[] = []

function SiteFooter({ brand, description, groups = noGroups, bottom, className, children, ...props }: SiteFooterProps) {
  return (
    <footer data-slot="site-footer" className={cn("@container w-full border-t", className)} {...props}>
      <div className="mx-auto flex w-full max-w-295 flex-col gap-group px-section py-section narrow:px-group">
        <div className="flex flex-col gap-section @3xl:flex-row @3xl:justify-between">
          {(brand !== undefined || description !== undefined) && (
            <div className="flex max-w-xs flex-col gap-items">
              {brand !== undefined && (
                <div data-slot="site-footer-brand" className="flex items-center gap-inline text-title-sm">
                  {brand}
                </div>
              )}
              {description !== undefined && <p className="text-body-sm text-muted-foreground">{description}</p>}
            </div>
          )}
          <div className="flex flex-wrap gap-section">
            {groups.map((group) => (
              <nav key={group.title} aria-label={group.title} className="flex flex-col gap-items">
                <p className="text-meta tracking-meta text-muted-foreground uppercase">{group.title}</p>
                <ul className="flex flex-col gap-inline">
                  {group.links.map(({ label, ...link }) => (
                    <li key={link.href}>
                      <Link variant="muted" className="text-body-sm" {...link}>
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
            {children}
          </div>
        </div>
        {bottom !== undefined && (
          <>
            <Separator />
            <div data-slot="site-footer-bottom" className="text-caption text-muted-foreground">
              {bottom}
            </div>
          </>
        )}
      </div>
    </footer>
  )
}

export { SiteFooter }
export type { SiteFooterGroup, SiteFooterLink, SiteFooterProps }
