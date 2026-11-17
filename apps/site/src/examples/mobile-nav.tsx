import { BotIcon, FolderIcon, HouseIcon, RocketIcon, SettingsIcon } from "lucide-react"
import { MobileNav } from "@/components/ui/mobile-nav"

export default function MobileNavDemo() {
  return (
    <div className="relative h-40 w-full max-w-sm overflow-hidden rounded-surface border bg-muted">
      <MobileNav
        label="Phone preview"
        always
        className="absolute"
        items={[
          { label: "Overview", href: "#overview", icon: <HouseIcon /> },
          { label: "Projects", href: "#projects", icon: <FolderIcon />, badge: 4, current: true },
          { label: "Deploys", href: "#deploys", icon: <RocketIcon /> },
          { label: "Agents", href: "#agents", icon: <BotIcon /> },
        ]}
        overflow={[{ label: "Settings", href: "#settings", icon: <SettingsIcon /> }]}
      />
    </div>
  )
}
