import { LaptopIcon, RotateCcwIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DeviceApproval, type DevicePermission } from "@/components/ui/device-approval"

const REQUEST_LIFETIME_MS = 5 * 60_000

const granted: DevicePermission[] = [
  { id: "projects", label: "Read and edit projects", description: "Every project you can open today" },
  { id: "jobs", label: "Run jobs on your behalf" },
]

const withheld: DevicePermission[] = [
  { id: "members", label: "Manage members", reason: "Your role can't grant this." },
  { id: "billing", label: "See billing", reason: "Only owners can grant this." },
]

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export default function DeviceApprovalDemo() {
  const [request, setRequest] = useState(() => ({ id: 1, expiresAt: Date.now() + REQUEST_LIFETIME_MS }))

  const restart = () => setRequest((current) => ({ id: current.id + 1, expiresAt: Date.now() + REQUEST_LIFETIME_MS }))

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Approve a device</CardTitle>
        <CardDescription>Check the code, then choose what happens.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-group">
        <DeviceApproval
          key={request.id}
          device={{
            name: "Studio laptop",
            kind: "Desktop",
            icon: <LaptopIcon />,
            detail: "Asked a moment ago from Lisbon",
          }}
          code="BCDF-GHJK"
          compare="enter"
          compareText={{
            label: "Code shown on the laptop",
            description: "Type it to make sure you're approving the right device. Try BCDF-GHJK.",
            matches: "The codes match",
            mismatch: "The codes don't match",
          }}
          granted={granted}
          withheld={withheld}
          warning="Only approve a device you're holding. Nobody from support will ask you for this code."
          expiresAt={request.expiresAt}
          onApprove={() => wait(800)}
          onDeny={() => wait(500)}
          text={{
            description: "This device asked to connect to your workspace.",
            code: "Pairing code",
            granted: "It will be able to",
            withheld: "It asked for, but won't get",
            approve: "Approve",
            deny: "Deny",
            approveAgentConfirm: "Gives Studio laptop access to your workspace",
            error: "The decision couldn't be sent. Try again.",
            expiresIn: (_ms, time) => `This request expires in ${time}`,
            expired: "This request has expired. Start again on the device.",
            approved: "Studio laptop is connected.",
            denied: "Studio laptop was denied.",
          }}
        />
        <Button variant="ghost" size="sm" className="self-start" onClick={restart}>
          <RotateCcwIcon />
          Start over
        </Button>
      </CardContent>
    </Card>
  )
}
