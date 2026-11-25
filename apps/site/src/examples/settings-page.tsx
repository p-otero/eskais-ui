import { useState, type CSSProperties } from "react"

import { Button } from "@/components/ui/button"
import { DescriptionDetails, DescriptionItem, DescriptionTerm } from "@/components/ui/description-list"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import {
  SettingsDangerAction,
  SettingsDangerZone,
  SettingsFacts,
  SettingsPage,
  SettingsRow,
  SettingsSection,
} from "@/components/ui/settings-page"
import { Switch } from "@/components/ui/switch"

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const timeouts = [
  { value: "15m", label: "15 minutes" },
  { value: "1h", label: "1 hour" },
  { value: "8h", label: "8 hours" },
  { value: "never", label: "Never" },
]

const device = [
  ["Name", "Studio MacBook"],
  ["Operating system", "macOS 15.2"],
  ["Browser", "Safari 18"],
  ["Signed in", "12 March 2026"],
  ["Last address", "203.0.113.24"],
] as const

export default function SettingsPageDemo() {
  const [signOutAfter, setSignOutAfter] = useState<string | null>("8h")
  const [forgetting, setForgetting] = useState(false)
  return (
    <SettingsPage className="w-full" style={{ "--settings-top": "var(--docs-top, 0px)" } as CSSProperties}>
      <SettingsSection id="account" title="Account" description="How you appear to your team.">
        <SettingsRow label="Display name" description="Shown on comments and approvals.">
          <Input defaultValue="Ana Ruiz" className="w-64 max-w-full" />
        </SettingsRow>
        <SettingsRow label="Email updates" description="A weekly summary of your projects.">
          <Switch defaultChecked />
        </SettingsRow>
      </SettingsSection>
      <SettingsSection
        id="security"
        title="Security"
        description="Protect your account and your sessions."
        actions={
          <Button size="sm" variant="outline">
            Download recovery codes
          </Button>
        }
      >
        <SettingsRow label="Two-factor authentication" description="Ask for a code from your authenticator app.">
          <Switch defaultChecked />
        </SettingsRow>
        <SettingsRow label="Sign out after" description="When you are inactive for this long.">
          <Select
            options={timeouts}
            value={signOutAfter}
            onValueChange={setSignOutAfter}
            triggerProps={{ className: "w-44" }}
          />
        </SettingsRow>
        <SettingsRow field={false} label="Other sessions" description="3 browsers and 1 phone are signed in.">
          <Button variant="outline" onClick={() => wait(800)}>
            Sign out other sessions
          </Button>
        </SettingsRow>
      </SettingsSection>
      <SettingsSection id="device" title="This device" description="What this browser reports about itself.">
        <SettingsFacts aria-label="This device">
          {device.map(([term, details]) => (
            <DescriptionItem key={term}>
              <DescriptionTerm>{term}</DescriptionTerm>
              <DescriptionDetails mono={term === "Last address"} copyable={term === "Last address"}>
                {details}
              </DescriptionDetails>
            </DescriptionItem>
          ))}
        </SettingsFacts>
      </SettingsSection>
      <SettingsSection id="notifications" title="Notifications" description="Where we tell you about activity.">
        <SettingsRow label="Mentions" description="When someone mentions you in a comment.">
          <Switch defaultChecked />
        </SettingsRow>
        <SettingsRow label="Failed runs" description="When a run you started fails.">
          <Switch defaultChecked />
        </SettingsRow>
        <SettingsRow label="Product news" description="A few times a year.">
          <Switch />
        </SettingsRow>
      </SettingsSection>
      <SettingsDangerZone id="danger" title="Danger zone" description="These can't be undone.">
        <SettingsDangerAction
          label="Forget this device"
          description="Signs this browser out and removes its saved keys."
          trigger="Forget device"
          title="Forget this device?"
          consequence="You will need your password and a code to sign in here again."
          confirmLabel="Forget it"
          agentConfirm="Signs this browser out and removes its saved keys"
          pending={forgetting}
          onConfirm={() => {
            setForgetting(true)
            void wait(2500).then(() => setForgetting(false))
          }}
        />
        <SettingsDangerAction
          label="Delete account"
          description="Removes your account, your projects and their history."
          trigger="Delete account"
          title="Delete your account?"
          consequence="Your projects and their history are deleted for everyone, at once."
          confirmLabel="Delete forever"
          agentConfirm="Deletes the account, its projects and their history"
          onConfirm={() => wait(800)}
        />
      </SettingsDangerZone>
    </SettingsPage>
  )
}
