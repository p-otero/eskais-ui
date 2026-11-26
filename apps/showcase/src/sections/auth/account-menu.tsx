import { BellIcon, FolderIcon, InboxIcon, MonitorSmartphoneIcon, ShieldIcon, SunIcon, UserPlusIcon } from "lucide-react"
import { useCallback, useState } from "react"

import { AccountMenu } from "@/components/ui/account-menu"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { PageLayout } from "@/components/ui/page-layout"
import { Shell, type ShellRoute } from "@/components/ui/shell"

const routes: ShellRoute[] = [
  { id: "inbox", label: "Inbox", href: "/inbox", icon: InboxIcon, mobile: true },
  { id: "today", label: "Today", href: "/today", icon: SunIcon, mobile: true },
  { id: "projects", label: "Projects", href: "/projects", icon: FolderIcon, mobile: true },
  { id: "devices", label: "Devices", href: "/devices", icon: MonitorSmartphoneIcon },
]

function AccountMenuDemo() {
  const [current, setCurrent] = useState("/inbox")
  const [signedOut, setSignedOut] = useState(false)
  const navigate = useCallback((href: string) => setCurrent(href), [])
  return (
    <Shell
      routes={routes}
      currentHref={current}
      onNavigate={navigate}
      storageKey="showcase-account-menu"
      brand={<span className="text-title-sm narrow:sr-only">Northwind</span>}
      actions={
        <>
          <Button variant="ghost" size="icon" aria-label="Notifications">
            <BellIcon />
          </Button>
          <AccountMenu
            user={{ name: "Ana Ruiz", email: "ana@northwind.example" }}
            roleLabel="Admin"
            roleTone="violet"
            items={[
              {
                value: "devices",
                label: "Devices",
                icon: <MonitorSmartphoneIcon />,
                onSelect: () => navigate("/devices"),
              },
              { value: "security", label: "Security", icon: <ShieldIcon /> },
              { value: "invite", label: "Invite", icon: <UserPlusIcon /> },
            ]}
            signOutLabel="Sign out"
            confirmSignOut={{
              title: "Sign out of Northwind?",
              confirmLabel: "Sign out now",
              agentConfirm: "Signs Ana out of this device",
            }}
            onSignOut={() => setSignedOut(true)}
          />
        </>
      }
    >
      <PageLayout
        width="dense"
        header={
          <PageHeader
            title={routes.find((route) => route.href === current)?.label ?? "Inbox"}
            description={signedOut ? "Signed out." : "The account menu sits at the end of the topbar."}
          />
        }
      >
        <p className="text-body-sm text-muted-foreground">Collapse the sidebar or narrow the window: the menu stays.</p>
      </PageLayout>
    </Shell>
  )
}

export { AccountMenuDemo }
