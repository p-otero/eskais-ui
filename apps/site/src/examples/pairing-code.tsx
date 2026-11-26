import { useState } from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PairingCode, PairingCodeInput } from "@/components/ui/pairing-code"

const USER_CODE_ALPHABET = "BCDFGHJKLMNPQRSTVWXZ"
const WAITING_CODE = "BCDFGHJK"

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type Lookup = { state: "idle" } | { state: "looking" } | { state: "missing" } | { state: "found"; device: string }

export default function PairingCodeDemo() {
  const [lookup, setLookup] = useState<Lookup>({ state: "idle" })

  const verify = async (code: string) => {
    setLookup({ state: "looking" })
    await wait(700)
    setLookup(code === WAITING_CODE ? { state: "found", device: "Studio laptop" } : { state: "missing" })
  }

  return (
    <div className="grid w-full max-w-4xl gap-section @container md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>On the device</CardTitle>
          <CardDescription>Open the verification page on your phone or computer and enter this code.</CardDescription>
        </CardHeader>
        <CardContent>
          <PairingCode code={WAITING_CODE} label="Pairing code" size="lg" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Connect a device</CardTitle>
          <CardDescription>Type the code your device shows. Try BCDF-GHJK.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-group">
          <PairingCodeInput
            label="Code shown on your device"
            length={8}
            alphabet={USER_CODE_ALPHABET}
            size="lg"
            placeholder="XXXX-XXXX"
            description="Letters only; the dash is added for you."
            pending={lookup.state === "looking"}
            error={
              lookup.state === "missing" ? "No device is waiting for that code. Check it and try again." : undefined
            }
            onChange={() => {
              if (lookup.state !== "looking") setLookup({ state: "idle" })
            }}
            onComplete={verify}
          />
          <output className="text-body text-muted-foreground empty:hidden">
            {lookup.state === "looking" ? "Looking up the code…" : null}
            {lookup.state === "found" ? `${lookup.device} is waiting for your approval.` : null}
          </output>
        </CardContent>
      </Card>
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Compare the codes</CardTitle>
          <CardDescription>When both screens show a code, ask the person to check them.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-section md:grid-cols-2">
          <PairingCode
            code={WAITING_CODE}
            label="Code on this screen"
            compare="confirm"
            text={{
              prompt: "Does your device show the same code?",
              matches: "It matches",
              mismatch: "It's different",
            }}
          />
          <PairingCode
            code={WAITING_CODE}
            label="Expected code"
            compare="enter"
            text={{
              label: "Type the code from your device",
              matches: "The codes match",
              mismatch: "The codes don't match",
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
