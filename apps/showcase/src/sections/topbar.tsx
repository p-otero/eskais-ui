import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Topbar } from "@/components/ui/topbar"

import { Section } from "../section"
import { BellIcon } from "../shell/shell-icons"

function TopbarSection() {
  return (
    <Section
      title="Topbar"
      description="The app screen's header: full width, a bottom border instead of a shadow, leading, centre and trailing slots. ?demo=shell puts it over a Sidebar with a SidebarTrigger and ⌘K search."
    >
      <div className="w-full overflow-hidden rounded-surface border">
        <Topbar
          className="static"
          leading={
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="#projects">Projects</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Apollo</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          }
          trailing={
            <>
              <Button variant="ghost" size="icon" aria-label="Notifications">
                <BellIcon />
              </Button>
              <Button size="sm">Deploy</Button>
            </>
          }
        />
        <p className="p-4 text-sm text-muted-foreground">
          The page scrolls under the bar; under glass it blurs what passes.
        </p>
      </div>
    </Section>
  )
}

export { TopbarSection }
