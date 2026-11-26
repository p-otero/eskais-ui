import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { checkServer, mount } from "@ui-sdk/core/testing"
import { createAgent } from "@ui-sdk/react/agent"
import { useState } from "react"
import { afterEach, beforeEach, expect, expectTypeOf, test, vi } from "vitest"

import {
  InvitationPanel,
  type Invitation,
  type InvitationLink,
  type InvitationPanelProps,
  type InvitationPanelText,
} from "@/components/ui/invitation-panel"
import { invitationPanel } from "@/components/ui/invitation-panel-primitive"
import { readAnnouncements, resetAnnouncer } from "@/lib/test-utils"

import { axeViolations } from "./axe"

const SECRET = "https://app.example/join/9f2c-one-time-token-7b1e"
const SECRET_TOKEN = "9f2c-one-time-token-7b1e"
const DAY = 86_400_000

let approve = false
const agent = createAgent({ allow: (step) => !step.confirm || approve })

const text: InvitationPanelText = {
  create: "Create invitation",
  role: "Role",
  createError: "The invitation couldn't be created.",
  newLink: "New invitation link",
  newLinkDescription: "Copy it now: it won't be shown again.",
  copy: "Copy link",
  copied: "Copied",
  expiresIn: (time) => <>Expires {time}</>,
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
  retry: "Try again",
}

const roles = [
  { value: "member", label: "Member" },
  { value: "admin", label: "Admin" },
]

const pending: Invitation[] = [
  { id: "inv-1", role: "member", createdBy: "Ana Ruiz", expiresAt: Date.now() + 3 * DAY },
  { id: "inv-2", role: "admin", createdBy: "Leo Park", expiresAt: Date.now() + 5 * DAY },
]

const writeText = vi.fn((_text: string) => Promise.resolve())

beforeEach(() => {
  approve = false
  writeText.mockClear()
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true })
})

afterEach(() => {
  cleanup()
  resetAnnouncer()
  vi.useRealTimers()
})

type HarnessProps = Partial<InvitationPanelProps> & { expiresIn?: number }

function Panel({ expiresIn = 7 * DAY, ...props }: HarnessProps) {
  const [invitations, setInvitations] = useState(pending)
  return (
    <InvitationPanel
      aria-label="Invitations"
      roles={roles}
      invitations={invitations}
      onCreate={({ role }) =>
        Promise.resolve<InvitationLink>({ id: `inv-${role ?? "none"}`, url: SECRET, expiresAt: Date.now() + expiresIn })
      }
      onRevoke={(id) => {
        setInvitations((current) => current.filter((invitation) => invitation.id !== id))
        return Promise.resolve()
      }}
      text={text}
      locale="en"
      {...props}
    />
  )
}

function attributesHolding(root: Element, needle: string) {
  return [root, ...root.querySelectorAll("*")].flatMap((element) =>
    Array.from(element.attributes)
      .filter((attribute) => attribute.value.includes(needle))
      .map((attribute) => `${element.tagName.toLowerCase()}[${attribute.name}]`),
  )
}

async function createFromButton() {
  fireEvent.click(screen.getByRole("button", { name: "Create invitation" }))
  return screen.findByText(SECRET)
}

test("primitive: renders on the server as a named group", () => {
  checkServer(invitationPanel, {}, `<root aria-label="Invitations"></root>`)
})

test("the new link shows its URL once, in one place, with its expiry and actions", async () => {
  render(<Panel />)
  const url = await createFromButton()
  const link = screen.getByRole("region", { name: "New invitation link" })
  expect(link.contains(url)).toBe(true)
  expect(within(link).getByText(/^Expires/).textContent).toContain("in 7 days")
  expect(within(link).getByRole("button", { name: "Copy link" })).toBeTruthy()
  expect(within(link).getByRole("button", { name: "Revoke new link" })).toBeTruthy()
  expect(screen.getAllByText(SECRET)).toHaveLength(1)
  expect(screen.getByRole("list", { name: "Pending invitations" }).textContent).not.toContain(SECRET_TOKEN)
})

test("the URL stays out of attributes, titles, announcements, storage and the address", async () => {
  render(<Panel />)
  await createFromButton()
  expect(attributesHolding(document.documentElement, SECRET_TOKEN)).toEqual([])
  expect(document.title).not.toContain(SECRET_TOKEN)
  expect(location.href).not.toContain(SECRET_TOKEN)
  expect(JSON.stringify({ ...localStorage })).not.toContain(SECRET_TOKEN)
  expect(JSON.stringify({ ...sessionStorage })).not.toContain(SECRET_TOKEN)
  await waitFor(() => expect(readAnnouncements().polite).toBe("Invitation link created"))
  const live = Array.from(document.querySelectorAll("[aria-live], [role=status], [role=alert]"))
  expect(live.map((region) => region.textContent).join(" ")).not.toContain(SECRET_TOKEN)
})

test("dismissing drops the URL from the DOM, and a copy afterwards is refused", async () => {
  render(<Panel />)
  await createFromButton()
  fireEvent.click(screen.getByRole("button", { name: "Done" }))
  expect(document.body.innerHTML).not.toContain(SECRET_TOKEN)
  expect(screen.queryByRole("region", { name: "New invitation link" })).toBeNull()
  const result = await agent.act({ steps: [{ ref: "Invitations", action: "copy" }] })
  expect(result.ok).toBe(false)
  expect(result.error?.message).toContain("copy isn't available: no new link is held")
  expect(writeText).not.toHaveBeenCalled()
})

test("unmounting the panel drops the URL: a panel mounted again holds no link", async () => {
  const view = render(<Panel />)
  await createFromButton()
  view.unmount()
  render(<Panel />)
  expect(document.body.innerHTML).not.toContain(SECRET_TOKEN)
  expect((await agent.act({ steps: [{ ref: "Invitations", action: "copy" }] })).ok).toBe(false)
})

test("Copy writes the URL to the clipboard and says Copied", async () => {
  render(<Panel />)
  await createFromButton()
  fireEvent.click(screen.getByRole("button", { name: "Copy link" }))
  await screen.findByRole("button", { name: "Copied" })
  expect(writeText).toHaveBeenCalledWith(SECRET)
  await waitFor(() => expect(readAnnouncements().polite).toBe("Link copied"))
})

test("the agent snapshot, act results, values and queries never hold the URL", async () => {
  render(<Panel />)
  const created = await agent.act({ steps: [{ ref: "Invitations", action: "create", args: ["Admin"] }] })
  expect(created.ok, created.error?.message).toBe(true)
  await screen.findByText(SECRET)
  const copied = await agent.act({ steps: [{ ref: "Invitations", action: "copy" }] })
  expect(copied.ok, copied.error?.message).toBe(true)
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(SECRET))
  const snapshot = agent.snapshot()
  const panel = snapshot.find((entry) => entry.label === "Invitations")
  expect(panel?.actions).toEqual(expect.arrayContaining(["create", "copy", "revoke"]))
  expect(panel).toMatchObject({ link: { id: "inv-admin", expired: false }, copied: true })
  const everything = JSON.stringify([
    snapshot,
    created,
    copied,
    await agent.query({ text: SECRET_TOKEN }),
    await agent.query({ text: "join" }),
    await agent.query({ within: "Invitations" }),
  ])
  expect(everything).not.toContain(SECRET_TOKEN)
  expect(everything).not.toContain("app.example")
})

test("create and copy resolve to the id, the expiry and copied, never to the URL", async () => {
  const view = mount(
    invitationPanel,
    {
      onCreate: () => Promise.resolve({ id: "inv-7", url: SECRET, expiresAt: 4_000_000_000_000 }),
    },
    `<root aria-label="Invitations"></root>`,
  )
  const created = await view.api.create()
  expect(created).toEqual({ id: "inv-7", expiresAt: 4_000_000_000_000 })
  expect(JSON.stringify(view.state)).not.toContain(SECRET_TOKEN)
  expect(await view.api.copy()).toBe("copied")
  expect(writeText).toHaveBeenCalledWith(SECRET)
  view.unmount()
})

test("an agent creates with a role by its label, and a role the panel doesn't offer fails the step", async () => {
  const onCreate = vi.fn(({ role }: { role: string | undefined }) =>
    Promise.resolve({ id: `inv-${String(role)}`, url: SECRET, expiresAt: Date.now() + DAY }),
  )
  render(<Panel onCreate={onCreate} />)
  const refused = await agent.act({ steps: [{ ref: "Invitations", action: "create", args: ["Owner"] }] })
  expect(refused.ok).toBe(false)
  expect(refused.error?.message).toContain("create takes one of these roles: Member, Admin.")
  expect(onCreate).not.toHaveBeenCalled()
  await agent.act({ steps: [{ ref: "Invitations", action: "create", args: ["admin"] }] })
  expect(onCreate).toHaveBeenCalledWith({ role: "admin" })
})

test("an agent picks the role through the Role select, and create uses it", async () => {
  const onCreate = vi.fn(() => Promise.resolve({ id: "inv-x", url: SECRET, expiresAt: Date.now() + DAY }))
  render(<Panel onCreate={onCreate} />)
  const result = await agent.act({
    steps: [
      { ref: "Role", action: "setValue", args: ["Admin"] },
      { ref: "Invitations", action: "create" },
    ],
  })
  expect(result.ok, result.error?.message).toBe(true)
  expect(onCreate).toHaveBeenCalledWith({ role: "admin" })
})

test("create while one is being created fails the step", async () => {
  render(<Panel onCreate={() => new Promise<InvitationLink>(() => undefined)} />)
  fireEvent.click(screen.getByRole("button", { name: "Create invitation" }))
  const result = await agent.act({ steps: [{ ref: "Invitations", action: "create" }] })
  expect(result.ok).toBe(false)
  expect(result.error?.message).toContain("create isn't available while an invitation is being created.")
  expect(screen.getByRole("button", { name: "Create invitation" }).getAttribute("aria-busy")).toBe("true")
})

test("a failed create shows a live destructive alert, without the panel's state holding a link", async () => {
  render(<Panel onCreate={() => Promise.reject(new Error("quota"))} />)
  fireEvent.click(screen.getByRole("button", { name: "Create invitation" }))
  const alert = await screen.findByRole("alert")
  expect(alert.textContent).toContain("The invitation couldn't be created.")
  expect(screen.queryByRole("region", { name: "New invitation link" })).toBeNull()
})

test("revoke with an unknown id fails the step and opens nothing", async () => {
  render(<Panel />)
  const result = await agent.act({ steps: [{ ref: "Invitations", action: "revoke", args: ["inv-404"] }] })
  expect(result.ok).toBe(false)
  expect(result.error?.message).toContain('revoke has no invitation with the id "inv-404".')
  expect(screen.queryByRole("alertdialog")).toBeNull()
})

test("an agent's revoke opens the confirmation, whose confirm needs a person: refused, then approved", async () => {
  const onRevoke = vi.fn(() => Promise.resolve())
  render(<Panel onRevoke={onRevoke} />)
  const ask = await agent.act({ steps: [{ ref: "Invitations", action: "revoke", args: ["inv-2"] }] })
  expect(ask.ok, ask.error?.message).toBe(true)
  await screen.findByRole("alertdialog", { name: "Revoke this invitation?" })
  const confirm = { steps: [{ ref: "Revoke this invitation?", action: "press", args: ["Revoke invitation now"] }] }
  expect((await agent.act(confirm)).ok).toBe(false)
  expect(onRevoke).not.toHaveBeenCalled()
  await agent.act({ steps: [{ ref: "Invitations", action: "revoke", args: ["inv-2"] }] })
  await screen.findByRole("alertdialog")
  approve = true
  const done = await agent.act(confirm)
  expect(done.ok, done.error?.message).toBe(true)
  expect(onRevoke).toHaveBeenCalledWith("inv-2")
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
})

test("revoking the new link forgets its URL", async () => {
  render(<Panel />)
  await createFromButton()
  fireEvent.click(screen.getByRole("button", { name: "Revoke new link" }))
  const dialog = await screen.findByRole("alertdialog")
  expect(dialog.querySelector("[data-agent-confirm]")?.getAttribute("data-agent-confirm")).toBe(
    "Revokes the invitation; its link stops working",
  )
  fireEvent.click(within(dialog).getByRole("button", { name: "Revoke invitation now" }))
  await waitFor(() => expect(document.body.innerHTML).not.toContain(SECRET_TOKEN))
  expect(screen.queryByRole("region", { name: "New invitation link" })).toBeNull()
})

test("the link expires on time: the URL leaves, Expired shows and is read, and copy is refused", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  render(<Panel expiresIn={5 * 60_000} />)
  fireEvent.click(screen.getByRole("button", { name: "Create invitation" }))
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10)
  })
  expect(screen.getByText(SECRET)).toBeTruthy()
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5 * 60_000 + 10)
  })
  expect(document.body.innerHTML).not.toContain(SECRET_TOKEN)
  expect(screen.getAllByText("This link has expired.").length).toBeGreaterThan(0)
  expect(screen.queryByRole("button", { name: "Copy link" })).toBeNull()
  vi.useRealTimers()
  const result = await agent.act({ steps: [{ ref: "Invitations", action: "copy" }] })
  expect(result.ok).toBe(false)
  expect(result.error?.message).toContain("copy isn't available: no new link is held")
})

test("no expiry timer runs while the page is hidden; coming back checks the clock", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  render(<Panel expiresIn={60_000} />)
  fireEvent.click(screen.getByRole("button", { name: "Create invitation" }))
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10)
  })
  Object.defineProperty(document, "hidden", { value: true, configurable: true })
  const timersBefore = vi.getTimerCount()
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"))
  })
  expect(vi.getTimerCount()).toBeLessThan(timersBefore)
  vi.setSystemTime(Date.now() + 120_000)
  expect(screen.getByText(SECRET)).toBeTruthy()
  Object.defineProperty(document, "hidden", { value: false, configurable: true })
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"))
  })
  expect(document.body.innerHTML).not.toContain(SECRET_TOKEN)
  expect(screen.getAllByText("This link has expired.").length).toBeGreaterThan(0)
})

test("pending invitations show role, creator, expiry and a revoke named for the row, never a URL", () => {
  render(<Panel />)
  const list = screen.getByRole("list", { name: "Pending invitations" })
  expect(list.textContent).toContain("Member")
  expect(list.textContent).toContain("Created by Ana Ruiz")
  expect(list.textContent).toContain("Expires in 3 days")
  expect(within(list).getByRole("button", { name: "Revoke Admin invitation from Leo Park" })).toBeTruthy()
})

test("the pending list's type has no url field", () => {
  expectTypeOf<Invitation>().not.toHaveProperty("url")
  const invitation: Invitation = {
    id: "inv-3",
    createdBy: "Ana",
    expiresAt: 0,
    // @ts-expect-error -- a pending invitation never carries its link
    url: SECRET,
  }
  expect(invitation.id).toBe("inv-3")
})

test("the pending list loads, empties and fails through DataState", () => {
  const onRetry = vi.fn()
  const { rerender } = render(<Panel status="pending" invitations={[]} />)
  expect(screen.getByText("Loading")).toBeTruthy()
  rerender(<Panel status="success" invitations={[]} />)
  expect(screen.getByText("No pending invitations")).toBeTruthy()
  rerender(<Panel status="error" error={new Error("offline")} onRetry={onRetry} invitations={[]} />)
  expect(screen.getByText("Invitations couldn't load")).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Try again" }))
  expect(onRetry).toHaveBeenCalled()
})

test("every control is named, and agents see the panel's actions and its invitations as items", () => {
  render(<Panel />)
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  const panel = components.find((entry) => entry.label === "Invitations")
  expect(panel?.items).toEqual([
    { value: "inv-1", label: "Member, Created by Ana Ruiz" },
    { value: "inv-2", label: "Admin, Created by Leo Park" },
  ])
  const labels = components.map((entry) => entry.label)
  for (const label of ["Role", "Create invitation", "Revoke Member invitation from Ana Ruiz"])
    expect(labels).toContain(label)
})

test("has no axe violations, with and without a new link", async () => {
  const { container } = render(<Panel />)
  expect(await axeViolations(container)).toEqual([])
  await createFromButton()
  expect(await axeViolations(container)).toEqual([])
})
