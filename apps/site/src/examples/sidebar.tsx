import { Sidebar, SidebarGroup, SidebarItem } from "@/components/ui/sidebar"

function Glyph({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

export default function SidebarDemo() {
  return (
    <div className="flex h-80 w-full overflow-hidden rounded-surface border bg-background">
      <Sidebar label="Workspace navigation" header={<span className="text-title-sm">Acme</span>}>
        <SidebarGroup label="Workspace">
          <SidebarItem href="#overview" icon={<Glyph d="M3 12 12 4l9 8M5 10v10h14V10" />} current>
            Overview
          </SidebarItem>
          <SidebarItem href="#deployments" icon={<Glyph d="M12 3v12m0 0-4-4m4 4 4-4M4 21h16" />} badge="23">
            Deployments
          </SidebarItem>
        </SidebarGroup>
        <SidebarGroup label="Account">
          <SidebarItem href="#settings" icon={<Glyph d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />}>
            Settings
          </SidebarItem>
        </SidebarGroup>
      </Sidebar>
      <div className="flex-1 p-inset-surface text-body-sm text-muted-foreground">Page content</div>
    </div>
  )
}
