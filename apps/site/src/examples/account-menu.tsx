import { MonitorSmartphoneIcon, ShieldIcon, UserPlusIcon } from "lucide-react"
import { useState } from "react"

import { AccountMenu } from "@/components/ui/account-menu"
import { Button } from "@/components/ui/button"

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export default function AccountMenuDemo() {
  const [last, setLast] = useState<string>()
  const [signedIn, setSignedIn] = useState(true)
  return (
    <div className="flex w-full max-w-xl flex-col gap-items">
      <div className="flex min-h-(--topbar-height) items-center justify-between gap-items rounded-surface border bg-background px-group py-items">
        <span className="text-title-sm">Northwind</span>
        {signedIn ? (
          <AccountMenu
            user={{ name: "Ana Ruiz", email: "ana@northwind.example" }}
            roleLabel="Admin"
            roleTone="violet"
            items={[
              {
                value: "devices",
                label: "Devices",
                icon: <MonitorSmartphoneIcon />,
                onSelect: () => setLast("Devices"),
              },
              { value: "security", label: "Security", icon: <ShieldIcon />, onSelect: () => setLast("Security") },
              { value: "invite", label: "Invite", icon: <UserPlusIcon />, onSelect: () => setLast("Invite") },
            ]}
            signOutLabel="Sign out"
            confirmSignOut={{
              title: "Sign out of Northwind?",
              description: "You'll need your passkey to sign in again on this device.",
              confirmLabel: "Sign out now",
              agentConfirm: "Signs Ana out of this device",
            }}
            onSignOut={async () => {
              await wait(600)
              setSignedIn(false)
            }}
          />
        ) : (
          <Button size="sm" onClick={() => setSignedIn(true)}>
            Sign in again
          </Button>
        )}
      </div>
      <p className="text-caption text-muted-foreground" aria-live="polite">
        {signedIn ? (last === undefined ? "Open the account menu." : `Opened ${last}.`) : "Signed out."}
      </p>
    </div>
  )
}
