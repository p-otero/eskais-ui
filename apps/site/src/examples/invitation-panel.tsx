import { useState, type ReactNode } from "react"
import { z } from "zod"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FormField } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { InvitationPanel, type Invitation, type InvitationRequest } from "@/components/ui/invitation-panel"

const HOUR = 3_600_000
const DAY = 24 * HOUR

const roles = [
  { value: "viewer", label: "Viewer" },
  { value: "editor", label: "Editor" },
  { value: "admin", label: "Admin" },
]

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function oneTimeToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

const seeded: Invitation[] = [
  {
    id: "inv-41",
    role: "editor",
    createdBy: "Leo Park",
    invitee: "mia@northwind.example",
    expiresAt: Date.now() + 2 * DAY,
  },
  { id: "inv-42", role: "viewer", createdBy: "Ana Ruiz", expiresAt: Date.now() + 5 * HOUR },
]

const expiresIn = (time: ReactNode) => <>Expires {time}</>

const invitee = z.object({ name: z.string().min(1), email: z.email() })

export default function InvitationPanelDemo() {
  const [invitations, setInvitations] = useState(seeded)

  const create = async ({ role, values }: InvitationRequest<z.output<typeof invitee>>) => {
    await wait(500)
    if (invitations.some((invitation) => invitation.invitee === values.email))
      throw new Error(`${values.email} already has a pending invitation.`)
    const id = `inv-${String(Date.now())}`
    const expiresAt = Date.now() + 2 * DAY
    setInvitations((current) => [{ id, role, createdBy: "You", invitee: values.email, expiresAt }, ...current])
    return { id, url: `https://northwind.example/join/${oneTimeToken()}`, expiresAt }
  }

  const revoke = async (id: string) => {
    await wait(400)
    setInvitations((current) => current.filter((invitation) => invitation.id !== id))
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Invite people</CardTitle>
        <CardDescription>Each link signs one person up with the role you choose.</CardDescription>
      </CardHeader>
      <CardContent>
        <InvitationPanel
          aria-label="Invitations"
          roles={roles}
          defaultRole="editor"
          invitations={invitations}
          schema={invitee}
          defaultValues={{ name: "", email: "" }}
          fields={
            <div className="grid gap-items sm:grid-cols-2">
              <FormField name="name" label="Name">
                <Input autoComplete="off" />
              </FormField>
              <FormField name="email" label="Email">
                <Input type="email" autoComplete="off" />
              </FormField>
            </div>
          }
          onCreate={create}
          onRevoke={revoke}
          text={{
            create: "Create invitation link",
            role: "Role",
            createError: (error) =>
              error instanceof Error ? error.message : "The invitation couldn't be created. Try again.",
            newLink: "New invitation link",
            newLinkDescription: "Copy it now: it's shown only once. If it gets lost, revoke it and create another.",
            copy: "Copy link",
            copied: "Copied",
            expiresIn,
            expired: "This link has expired.",
            revoke: "Revoke",
            revokeTitle: "Revoke this invitation?",
            revokeDescription: "Its link stops working at once.",
            revokeConfirm: "Revoke invitation",
            revokeAgentConfirm: "Revokes the invitation; its link stops working",
            dismiss: "Done",
            pending: "Pending invitations",
            createdBy: (name) => `Created by ${name}`,
            emptyTitle: "No pending invitations",
            errorTitle: "Invitations couldn't load",
          }}
        />
      </CardContent>
    </Card>
  )
}
