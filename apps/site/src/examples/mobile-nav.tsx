import { MobileNav } from "@/components/ui/mobile-nav"

const dot = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="5" fill="currentColor" />
  </svg>
)

export default function MobileNavDemo() {
  return (
    <div className="relative h-40 w-full max-w-sm overflow-hidden rounded-surface border bg-muted">
      <MobileNav
        label="Phone preview"
        always
        className="absolute"
        items={[
          { label: "Overview", href: "#overview", icon: dot },
          { label: "Projects", href: "#projects", icon: dot, badge: 4, current: true },
          { label: "Deploys", href: "#deploys", icon: dot },
          { label: "Agents", href: "#agents", icon: dot },
        ]}
        overflow={[{ label: "Settings", href: "#settings", icon: dot }]}
      />
    </div>
  )
}
