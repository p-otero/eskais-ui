import { RotateCcwIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DeviceCodePrompt, type DeviceCodePromptText } from "@/components/ui/device-code-prompt"

const CODE_LIFETIME_MS = 10 * 60_000

const verificationUri = "https://provider.example/device"

const text: DeviceCodePromptText = {
  instructions: (link) => <>Go to {link} and enter this code.</>,
  open: "Open sign-in page",
  expiresIn: (_ms, time) => `Code expires in ${time}`,
  expired: "This code has expired. Ask for a new one.",
}

export default function DeviceCodePromptDemo() {
  const [flow, setFlow] = useState(() => ({ id: 1, code: "WDJB-MJHT", expiresAt: Date.now() + CODE_LIFETIME_MS }))
  const [expired, setExpired] = useState(false)

  const restart = () => {
    setExpired(false)
    setFlow((current) => ({ id: current.id + 1, code: "QKFR-TXPN", expiresAt: Date.now() + CODE_LIFETIME_MS }))
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>Sign in at the provider</CardTitle>
        <CardDescription>Approve this app on the provider's site to link your account.</CardDescription>
      </CardHeader>
      <CardContent>
        <DeviceCodePrompt
          key={flow.id}
          code={flow.code}
          verificationUri={verificationUri}
          verificationUriComplete={`${verificationUri}?user_code=${flow.code}`}
          expiresAt={flow.expiresAt}
          onExpire={() => setExpired(true)}
          copyLink
          actions={
            <Button variant={expired ? "outline" : "ghost"} className="narrow:w-full" onClick={restart}>
              <RotateCcwIcon />
              New code
            </Button>
          }
          text={text}
        />
      </CardContent>
    </Card>
  )
}
