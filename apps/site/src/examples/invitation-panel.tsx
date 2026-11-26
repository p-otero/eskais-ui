import { useState, type ReactNode } from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { InvitationPanel, type Invitation, type InvitationLink } from "@/components/ui/invitation-panel"

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
  { id: "inv-41", role: "editor", createdBy: "Leo Park", expiresAt: Date.now() + 2 * DAY },
  { id: "inv-42", role: "viewer", createdBy: "Ana Ruiz", expiresAt: Date.now() + 5 * HOUR },
]

const expiresIn = (time: ReactNode) => <>Expires {time}</>

export default function InvitationPanelDemo() {
  const [invitations, setInvitations] = useState(seeded)

  const create = async ({ role }: { role: string | undefined }): Promise<InvitationLink> => {
    await wait(500)
    const id = `inv-${String(Date.now())}`
    const expiresAt = Date.now() + 2 * DAY
    setInvitations((current) => [{ id, role, createdBy: "You", expiresAt }, ...current])
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
          onCreate={create}
          onRevoke={revoke}
          text={{
            create: "Create invitation link",
            role: "Role",
            createError: "The invitation couldn't be created. Try again.",
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
