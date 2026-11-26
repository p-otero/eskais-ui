import { useState, type ReactNode } from "react"
import { z } from "zod"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FormField } from "@/components/ui/form"
import { FormDialog } from "@/components/ui/form-dialog"
import { Input } from "@/components/ui/input"
import { SecretList, type StoredSecret } from "@/components/ui/secret-list"

const HOUR = 3_600_000
const DAY = 24 * HOUR

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const schema = z.object({ value: z.string().min(12) })

const seeded: StoredSecret[] = [
  {
    id: "openai",
    name: "OpenAI API key",
    description: "Summaries and search",
    configured: true,
    fingerprint: "x7Qa",
    createdAt: Date.now() - 40 * DAY,
    updatedAt: Date.now() - 6 * DAY,
    lastUsedAt: Date.now() - 2 * HOUR,
  },
  {
    id: "stripe",
    name: "Stripe webhook secret",
    configured: true,
    fingerprint: "9f2c",
    createdAt: Date.now() - 90 * DAY,
    updatedAt: Date.now() - 90 * DAY,
    lastUsedAt: null,
  },
  { id: "github", name: "GitHub token", description: "Opens pull requests", configured: false },
]

const created = (time: ReactNode) => <>Created {time}</>
const updated = (time: ReactNode) => <>Updated {time}</>
const lastUsed = (time: ReactNode) => <>Last used {time}</>

export default function SecretListDemo() {
  const [secrets, setSecrets] = useState(seeded)
  const [replacing, setReplacing] = useState<StoredSecret | null>(null)

  const store = async (id: string, value: string) => {
    await wait(600)
    const now = Date.now()
    setSecrets((current) =>
      current.map((secret) =>
        secret.id === id
          ? {
              ...secret,
              configured: true,
              fingerprint: value.slice(-4),
              updatedAt: now,
              createdAt: secret.createdAt ?? now,
            }
          : secret,
      ),
    )
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>API keys</CardTitle>
        <CardDescription>Stored encrypted for your account. Values can be replaced, never read back.</CardDescription>
      </CardHeader>
      <CardContent>
        <SecretList
          aria-label="API keys"
          secrets={secrets}
          onReplace={(id) => setReplacing(secrets.find((secret) => secret.id === id) ?? null)}
          onDelete={async (id) => {
            await wait(400)
            setSecrets((current) => current.filter((secret) => secret.id !== id))
          }}
          text={{
            configured: "Configured",
            missing: "Missing",
            replace: "Replace",
            set: "Set",
            delete: "Delete",
            deleteTitle: (secret) => `Delete ${secret.name}?`,
            deleteDescription: "Anything that uses it stops working until you set a new one.",
            deleteConfirm: "Delete secret",
            deleteAgentConfirm: (secret) => `Deletes ${secret.name}; anything using it stops working`,
            created,
            updated,
            lastUsed,
            neverUsed: "Never used",
            emptyTitle: "No secrets yet",
            errorTitle: "Secrets couldn't load",
          }}
        />
        <FormDialog
          open={replacing !== null}
          onOpenChange={(open) => {
            if (!open) setReplacing(null)
          }}
          schema={schema}
          title={replacing?.configured ? `Replace ${replacing.name}` : `Set ${replacing?.name ?? ""}`}
          description="The new value replaces the stored one at once. It isn't shown again."
          submitLabel="Save"
          cancelLabel="Cancel"
          onSubmit={async ({ value }) => {
            if (replacing) await store(replacing.id, value)
          }}
        >
          <FormField name="value" label="Value">
            <Input sensitive revealable placeholder="Paste the key" />
          </FormField>
        </FormDialog>
      </CardContent>
    </Card>
  )
}
