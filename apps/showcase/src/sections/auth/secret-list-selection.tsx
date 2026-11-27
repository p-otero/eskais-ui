import { useState } from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SecretList, type StoredSecret } from "@/components/ui/secret-list"

const localSecrets: StoredSecret[] = [
  { id: "openai", name: "OpenAI API key", description: "From ~/.config/tools", configured: true, fingerprint: "x7Qa" },
  {
    id: "github",
    name: "GitHub token",
    description: "From the system keychain",
    configured: true,
    fingerprint: "9f2c",
  },
  {
    id: "stripe",
    name: "Stripe live key",
    configured: true,
    fingerprint: "41dd",
    disabled: { reason: "Live payment keys stay on this device." },
  },
  { id: "sentry", name: "Sentry DSN", configured: true, fingerprint: "c0de" },
]

function SecretListSelectionDemo() {
  const [selected, setSelected] = useState<string[]>(["openai"])
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-group p-inset-surface">
      <h1 className="text-display-sm tracking-tight">Choose secrets</h1>
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Keys on this device</CardTitle>
          <CardDescription>
            Pick the keys to upload to your account. Only their last characters leave the app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-items">
            <SecretList
              aria-label="Keys on this device"
              secrets={localSecrets}
              selectable
              selected={selected}
              onSelectedChange={setSelected}
              text={{
                configured: "Found",
                missing: "Missing",
                emptyTitle: "No keys found",
                errorTitle: "Keys couldn't load",
                selectAll: "Select all",
              }}
            />
            <p
              data-slot="secret-list-selection-count"
              className="text-body-sm text-muted-foreground"
              aria-live="polite"
            >
              {selected.length === 1 ? "1 key selected" : `${selected.length} keys selected`}
            </p>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}

export { SecretListSelectionDemo }
