import { DownloadIcon, HouseIcon, SettingsIcon } from "lucide-react"
import { Sidebar, SidebarGroup, SidebarItem } from "@/components/ui/sidebar"

export default function SidebarDemo() {
  return (
    <div className="flex h-80 w-full overflow-hidden rounded-surface border bg-background">
      <Sidebar label="Workspace navigation" header={<span className="text-title-sm">Acme</span>}>
        <SidebarGroup label="Workspace">
          <SidebarItem href="#overview" icon={<HouseIcon />} current>
            Overview
          </SidebarItem>
          <SidebarItem href="#deployments" icon={<DownloadIcon />} badge="23">
            Deployments
          </SidebarItem>
        </SidebarGroup>
        <SidebarGroup label="Account">
          <SidebarItem href="#settings" icon={<SettingsIcon />}>
            Settings
          </SidebarItem>
        </SidebarGroup>
      </Sidebar>
      <div className="flex-1 p-inset-surface text-body-sm text-muted-foreground">Page content</div>
    </div>
  )
}
