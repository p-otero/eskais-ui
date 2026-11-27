import { LaptopIcon, RotateCcwIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DeviceApproval, type DeviceApprovalDecision, type DeviceConsentItem } from "@/components/ui/device-approval"
import { SecretFingerprint } from "@/components/ui/secret-fingerprint"

const items: DeviceConsentItem[] = [
  {
    id: "openai",
    label: "OpenAI API key",
    description: "Your account already has one; this replaces it.",
    detail: <SecretFingerprint fingerprint="x7Qa" />,
    marker: { label: "Replace", confirm: "Replace the existing key" },
  },
  { id: "github", label: "GitHub token", description: "New", detail: <SecretFingerprint fingerprint="9f2c" /> },
  {
    id: "stripe",
    label: "Stripe live key",
    detail: <SecretFingerprint fingerprint="41dd" />,
    disabled: { reason: "Your role can't store payment keys." },
  },
]

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function DeviceApprovalItemsDemo() {
  const [attempt, setAttempt] = useState(1)
  const [sent, setSent] = useState<DeviceApprovalDecision | null>(null)
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-group p-inset-surface">
      <h1 className="text-display-sm tracking-tight">Upload keys</h1>
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Approve the upload</CardTitle>
          <CardDescription>Choose which keys the desktop app may store in your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-group">
            <DeviceApproval
              key={attempt}
              device={{
                name: "Studio laptop",
                kind: "Desktop app",
                icon: <LaptopIcon />,
                detail: "Asked a moment ago",
              }}
              items={items}
              defaultSelected={["github"]}
              onApprove={async (decision) => {
                await wait(600)
                setSent(decision)
              }}
              onDeny={() => wait(300)}
              text={{
                description: "The desktop app wants to upload keys it found on this computer.",
                items: "Keys to upload",
                nothingSelected: "Choose at least one key to upload.",
                unconfirmed: (labels) => `Confirm that ${labels.join(" and ")} replaces the key you have.`,
                granted: "It will be able to",
                withheld: "It asked for, but won't get",
                approve: "Upload",
                deny: "Cancel",
                approveAgentConfirm: "Uploads the chosen keys to your account",
                error: "The upload couldn't start. Try again.",
                approved: "The keys are on their way.",
                denied: "Nothing was uploaded.",
              }}
            />
            {sent === null ? null : (
              <p data-slot="device-approval-items-result" className="text-body-sm text-muted-foreground">
                Sent {sent.selected.join(", ")}; replacing {sent.confirmed.join(", ") || "nothing"}.
              </p>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => {
                setSent(null)
                setAttempt((current) => current + 1)
              }}
            >
              <RotateCcwIcon />
              Start over
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}

export { DeviceApprovalItemsDemo }
