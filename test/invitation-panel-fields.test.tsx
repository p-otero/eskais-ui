import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import type { ReactNode } from "react"
import { afterEach, expect, expectTypeOf, test, vi } from "vitest"
import { z } from "zod"

import { FormField, FormServerError } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  InvitationPanel,
  type InvitationLink,
  type InvitationPanelText,
  type InvitationRequest,
} from "@/components/ui/invitation-panel"
import { ignoreAnnouncer, resetAnnouncer } from "@/lib/test-utils"

import { axeViolations } from "./axe"

const SECRET = "https://app.example/join/5d1e-one-time-token-a77c"
const SECRET_TOKEN = "5d1e-one-time-token-a77c"
const PASSCODE = "pass-7f3a9e21c0"
const DAY = 86_400_000

const agent = createAgent()

afterEach(() => {
  cleanup()
  resetAnnouncer()
})

const text: InvitationPanelText = {
  create: "Create invitation",
  role: "Role",
  createError: "The invitation couldn't be created.",
  newLink: "New invitation link",
  copy: "Copy link",
  copied: "Copied",
  expiresIn: (time: ReactNode) => <>Expires {time}</>,
  expired: "This link has expired.",
  revoke: "Revoke",
  revokeTitle: "Revoke this invitation?",
  revokeConfirm: "Revoke invitation now",
  revokeAgentConfirm: "Revokes the invitation; its link stops working",
  dismiss: "Done",
  pending: "Pending invitations",
  createdBy: (name) => `Created by ${name}`,
  emptyTitle: "No pending invitations",
  errorTitle: "Invitations couldn't load",
}

const roles = [
  { value: "member", label: "Member" },
  { value: "admin", label: "Admin" },
]

const schema = z.object({
  name: z.string().min(1),
  email: z.email(),
  passcode: z.string().min(8),
})

type Created = InvitationRequest<z.output<typeof schema>>

function Invite({
  onCreate,
  formLabel,
  labelPlacement,
}: {
  onCreate: (request: Created) => InvitationLink | PromiseLike<InvitationLink>
  formLabel?: string
  labelPlacement?: "top" | "in" | "on"
}) {
  return (
    <InvitationPanel
      formLabel={formLabel}
      labelPlacement={labelPlacement}
      aria-label="Invitations"
      roles={roles}
      onCreate={onCreate}
      onRevoke={() => undefined}
      text={text}
      locale="en"
      schema={schema}
      defaultValues={{ name: "", email: "", passcode: "" }}
      fields={
        <>
          <FormField name="name" label="Name">
            <Input autoComplete="off" />
          </FormField>
          <FormField name="email" label="Email">
            <Input type="email" autoComplete="off" />
          </FormField>
          <FormField name="passcode" label="Passcode">
            <Input sensitive />
          </FormField>
        </>
      }
    />
  )
}

const link = (): InvitationLink => ({ id: "inv-9", url: SECRET, expiresAt: Date.now() + DAY })

async function fill(user: ReturnType<typeof userEvent.setup>, email = "leo@example.com") {
  await user.type(screen.getByLabelText(/^Name/), "Leo Park")
  await user.type(screen.getByLabelText(/^Email/), email)
  await user.type(screen.getByLabelText(/^Passcode/), PASSCODE)
}

test("onCreate's request is typed by the schema's output", () => {
  expectTypeOf<Created["values"]>().toEqualTypeOf<{ name: string; email: string; passcode: string }>()
  expectTypeOf<Created["role"]>().toEqualTypeOf<string | undefined>()
  expect(schema.safeParse({ name: "Leo", email: "leo@example.com", passcode: PASSCODE }).success).toBe(true)
})

test("create validates the fields first and passes their values with the role, then resets them", async () => {
  const user = userEvent.setup()
  const onCreate = vi.fn((_request: Created) => Promise.resolve(link()))
  render(<Invite onCreate={onCreate} />)
  await fill(user)
  await user.click(screen.getByRole("button", { name: "Create invitation" }))
  await screen.findByText(SECRET)
  expect(onCreate).toHaveBeenCalledWith({
    role: "member",
    values: { name: "Leo Park", email: "leo@example.com", passcode: PASSCODE },
  })
  await waitFor(() => expect(screen.getByLabelText<HTMLInputElement>(/^Name/).value).toBe(""))
  expect(screen.getByLabelText<HTMLInputElement>(/^Passcode/).value).toBe("")
  expect(document.body.innerHTML).not.toContain(PASSCODE)
})

test("invalid fields stop create: errors show on the fields and onCreate never runs", async () => {
  const user = userEvent.setup()
  const onCreate = vi.fn(() => Promise.resolve(link()))
  render(<Invite onCreate={onCreate} />)
  await user.type(screen.getByLabelText(/^Email/), "not-an-email")
  await user.click(screen.getByRole("button", { name: "Create invitation" }))
  await waitFor(() => expect(screen.getByLabelText(/^Email/).getAttribute("aria-invalid")).toBe("true"))
  expect(screen.getByLabelText(/^Name/).getAttribute("aria-invalid")).toBe("true")
  expect(onCreate).not.toHaveBeenCalled()
  expect(screen.queryByRole("region", { name: "New invitation link" })).toBeNull()
})

test("a FormServerError lands on its field, and its message shows in the live alert", async () => {
  const user = userEvent.setup()
  render(
    <Invite
      onCreate={() =>
        Promise.reject(new FormServerError("An account with this email already exists.", { email: "Already a member" }))
      }
    />,
  )
  await fill(user)
  await user.click(screen.getByRole("button", { name: "Create invitation" }))
  const alert = await screen.findByRole("alert", {}, { timeout: 2000 })
  await waitFor(() => expect(alert.textContent).toBe("An account with this email already exists."))
  expect(screen.getByText("Already a member", { ignore: ignoreAnnouncer })).toBeTruthy()
  expect(screen.getByLabelText<HTMLInputElement>(/^Passcode/).value).toBe(PASSCODE)
  expect(document.body.innerHTML).not.toContain(PASSCODE)
})

test("an agent fills the fields and creates with a role by its label; nothing it reads holds the link or a secret", async () => {
  const onCreate = vi.fn((_request: Created) => Promise.resolve(link()))
  render(<Invite onCreate={onCreate} />)
  const result = await agent.act({
    steps: [
      { ref: "Name", action: "setValue", args: ["Leo Park"] },
      { ref: "Email", action: "setValue", args: ["leo@example.com"] },
      { ref: "Passcode", action: "setValue", args: [PASSCODE] },
      { ref: "Invitations", action: "create", args: ["Admin"] },
    ],
  })
  expect(result.ok, result.error?.message).toBe(true)
  await screen.findByText(SECRET)
  expect(onCreate).toHaveBeenCalledWith({
    role: "admin",
    values: { name: "Leo Park", email: "leo@example.com", passcode: PASSCODE },
  })
  expect(screen.getByRole("combobox", { name: "Role" }).textContent).toContain("Admin")
  const seen = JSON.stringify([result, agent.snapshot(), await agent.query({ text: "join" })])
  expect(seen).not.toContain(SECRET_TOKEN)
  expect(seen).not.toContain(PASSCODE)
})

test("an agent's create with invalid fields returns, and the errors show on the fields it can read", async () => {
  const onCreate = vi.fn(() => Promise.resolve(link()))
  render(<Invite onCreate={onCreate} />)
  const result = await agent.act({ steps: [{ ref: "Invitations", action: "create" }] })
  expect(result.ok, result.error?.message).toBe(true)
  await waitFor(() => expect(screen.getByLabelText(/^Email/).getAttribute("aria-invalid")).toBe("true"))
  expect(onCreate).not.toHaveBeenCalled()
  const invalid = agent
    .snapshot()
    .filter((entry) => Array.isArray(entry.errors) && entry.errors.length > 0)
    .map((entry) => entry.label)
  expect(invalid.some((name) => name?.startsWith("Email"))).toBe(true)
})

test("has no axe violations with fields, empty and after a link is created", async () => {
  const user = userEvent.setup()
  const { container } = render(
    <main>
      <Invite onCreate={() => Promise.resolve(link())} />
    </main>,
  )
  expect(await axeViolations(container)).toEqual([])
  await fill(user)
  await user.click(within(container).getByRole("button", { name: "Create invitation" }))
  await screen.findByText(SECRET)
  expect(await axeViolations(container)).toEqual([])
})

test("the fields' form takes a name, and one label placement for every field", () => {
  const { container } = render(<Invite onCreate={link} formLabel="Invited person" labelPlacement="in" />)
  expect(screen.getByRole("form", { name: "Invited person" })).toBeTruthy()
  const fields = container.querySelectorAll("[data-slot=field]")
  expect(fields.length).toBeGreaterThan(0)
  for (const field of fields) expect(field.getAttribute("data-label-placement")).toBe("in")
})
