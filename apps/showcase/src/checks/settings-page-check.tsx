import { Suspense, use } from "react"

import { SettingsDangerZone, SettingsPage, SettingsRow, SettingsSection } from "@/components/ui/settings-page"
import { Switch } from "@/components/ui/switch"
import { createUrlParam } from "@/lib/url-param"
import { hashRouter } from "@/lib/url-router"

const url = createUrlParam("section", { router: hashRouter() })

const loaded = new Promise((resolve) => {
  setTimeout(resolve, 600)
})

const sections = [
  { id: "account", label: "Account" },
  { id: "security", label: "Security" },
  { id: "notifications", label: "Notifications" },
  { id: "danger-zone", label: "Danger zone" },
]

const rows = ["Email updates", "Weekly summary", "Mentions", "Replies", "Reminders", "Product news"]

function Rows({ prefix }: { prefix: string }) {
  return rows.map((row) => (
    <SettingsRow key={row} label={`${prefix}: ${row}`} description="Shown to check that sections scroll.">
      <Switch />
    </SettingsRow>
  ))
}

function LateDangerZone() {
  use(loaded)
  return (
    <SettingsDangerZone id="danger-zone" title="Danger zone" description="Loaded after the page.">
      <Rows prefix="Danger" />
    </SettingsDangerZone>
  )
}

function SettingsPageCheck() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-group p-inset-surface">
      <h1 className="text-display-sm tracking-tight">Settings check</h1>
      <SettingsPage url={url} sections={sections}>
        <SettingsSection id="account" title="Account">
          <Rows prefix="Account" />
        </SettingsSection>
        <SettingsSection id="security" title="Security">
          <Rows prefix="Security" />
        </SettingsSection>
        <SettingsSection id="notifications" title="Notifications">
          <Rows prefix="Notifications" />
        </SettingsSection>
        <Suspense fallback={null}>
          <LateDangerZone />
        </Suspense>
      </SettingsPage>
    </main>
  )
}

export { SettingsPageCheck }
