import { MobileNav } from "@/components/ui/mobile-nav"

import { Section } from "../section"
import { BotIcon, ChartIcon, FolderIcon, GearIcon, HomeIcon, RocketIcon } from "../shell/shell-icons"

function MobileNavSection() {
  return (
    <Section
      title="MobileNav"
      description="A bottom tab bar for narrow screens: up to five links, icon over label, the current page marked, More opening the rest above the bar. Shown here at every width with always."
    >
      <div className="relative h-56 w-full max-w-sm overflow-hidden rounded-surface border bg-muted">
        <p className="p-4 text-sm text-muted-foreground">
          Pair it with a Sidebar: the sidebar on wide screens, this bar on narrow ones, and the page keeps
          --mobile-nav-offset clear at the bottom.
        </p>
        <MobileNav
          label="Phone preview"
          always
          className="absolute"
          items={[
            { label: "Overview", href: "#overview", icon: <HomeIcon /> },
            { label: "Projects", href: "#projects", icon: <FolderIcon />, badge: 4, current: true },
            { label: "Deploys", href: "#deployments", icon: <RocketIcon /> },
            { label: "Agents", href: "#agents", icon: <BotIcon /> },
          ]}
          overflow={[
            { label: "Usage", href: "#usage", icon: <ChartIcon /> },
            { label: "Settings", href: "#settings", icon: <GearIcon /> },
          ]}
        />
      </div>
    </Section>
  )
}

export { MobileNavSection }
