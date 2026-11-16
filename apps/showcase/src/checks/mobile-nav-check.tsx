import { MobileNav, type MobileNavItem } from "@/components/ui/mobile-nav"

import { BotIcon, ChartIcon, FolderIcon, GearIcon, HomeIcon, RocketIcon } from "../shell/shell-icons"

// ?demo=mobile-nav-check: the fixture tooling/shell-check.mjs measures at 320px. Five routes with long labels, or
// with &overflow, four routes and More. The page keeps --mobile-nav-offset clear at its end.
const routes: readonly MobileNavItem[] = [
  { label: "Home", href: "#home", icon: <HomeIcon />, current: true },
  { label: "Wellness", href: "#wellness", icon: <ChartIcon />, badge: 3 },
  { label: "Schedule", href: "#schedule", icon: <FolderIcon /> },
  { label: "Messages", href: "#messages", icon: <BotIcon /> },
  { label: "Settings", href: "#settings", icon: <GearIcon /> },
]

const overflow: readonly MobileNavItem[] = [{ label: "Deployments", href: "#deployments", icon: <RocketIcon /> }]

function MobileNavCheck() {
  const withOverflow = new URLSearchParams(location.search).has("overflow")
  return (
    <>
      <main data-testid="page" className="flex flex-col gap-items p-section pb-0 mb-(--mobile-nav-offset)">
        <h1 className="text-title">Mobile navigation</h1>
        <p data-testid="last-line" className="text-body">
          The last line of the page ends where the bar begins.
        </p>
      </main>
      <MobileNav label="Primary" items={routes} overflow={withOverflow ? overflow : undefined} always />
    </>
  )
}

export { MobileNavCheck }
