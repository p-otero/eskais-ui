import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { createAgent } from "@ui-sdk/react/agent"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { AccountMenu, type AccountMenuProps } from "@/components/ui/account-menu"

import { axeViolations, settle } from "./overlay-helpers"

let approve = false
const agent = createAgent({ allow: (step) => !step.confirm || approve })

beforeEach(() => {
  approve = false
})
afterEach(cleanup)

const user = { name: "Ana Ruiz", email: "ana@example.com" }

function Menu(props: Partial<AccountMenuProps>) {
  return (
    <AccountMenu
      user={user}
      roleLabel="Admin"
      items={[
        { value: "devices", label: "Devices" },
        { value: "security", label: "Security" },
        { value: "invite", label: "Invite" },
      ]}
      signOutLabel="Sign out"
      onSignOut={() => undefined}
      {...props}
    />
  )
}

const trigger = () => screen.getByRole("button", { name: "Account: Ana Ruiz" })

async function open() {
  fireEvent.click(trigger())
  return screen.findByRole("menu")
}

test("the trigger shows the initials and the name, and is named for the account", () => {
  render(<Menu />)
  expect(trigger().textContent).toContain("AR")
  expect(trigger().textContent).toContain("Ana Ruiz")
  expect(trigger().getAttribute("aria-haspopup")).toBe("menu")
})

test("initials come from the first and last word, or the given ones", () => {
  const { rerender } = render(<Menu user={{ name: "maría josé de la luz" }} />)
  expect(screen.getByRole("button").textContent).toContain("ML")
  rerender(<Menu user={{ name: "Ana Ruiz", initials: "A" }} />)
  expect(trigger().textContent?.startsWith("A")).toBe(true)
})

test("the menu's header holds the name, email and role badge, and names the group of entries", async () => {
  render(<Menu />)
  const menu = await open()
  const header = menu.querySelector('[data-slot="account-menu-header"]')
  expect(header?.textContent).toContain("ana@example.com")
  expect(header?.querySelector('[data-slot="account-menu-role"]')?.textContent).toBe("Admin")
  const group = within(menu).getByRole("group")
  expect(group.getAttribute("aria-labelledby")).toBe(header?.id)
})

test("choosing an app entry runs its onSelect and closes the menu", async () => {
  const onSelect = vi.fn()
  render(<Menu items={[{ value: "devices", label: "Devices", onSelect }]} />)
  const menu = await open()
  fireEvent.click(within(menu).getByRole("menuitem", { name: "Devices" }))
  expect(onSelect).toHaveBeenCalledTimes(1)
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull())
})

test("sign-out without a confirmation signs out at once", async () => {
  const onSignOut = vi.fn()
  render(<Menu onSignOut={onSignOut} />)
  const menu = await open()
  fireEvent.click(within(menu).getByRole("menuitem", { name: "Sign out" }))
  expect(onSignOut).toHaveBeenCalledTimes(1)
})

test("sign-out with a confirmation asks first, and Cancel keeps the session", async () => {
  const onSignOut = vi.fn()
  render(
    <Menu
      onSignOut={onSignOut}
      confirmSignOut={{
        title: "Sign out?",
        confirmLabel: "Sign out now",
        agentConfirm: "Signs you out of this device",
      }}
    />,
  )
  const menu = await open()
  fireEvent.click(within(menu).getByRole("menuitem", { name: "Sign out" }))
  const dialog = await screen.findByRole("alertdialog", { name: "Sign out?" })
  expect(onSignOut).not.toHaveBeenCalled()
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }))
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
  expect(onSignOut).not.toHaveBeenCalled()
})

test("agents choose the menu's entries by name", async () => {
  const onSelect = vi.fn()
  render(<Menu items={[{ value: "security", label: "Security", onSelect }]} />)
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  expect(components.map((entry) => entry.label)).toContain("Account: Ana Ruiz")
  const result = await agent.act({ steps: [{ ref: "Account: Ana Ruiz", action: "press", args: ["Security"] }] })
  expect(result.ok, result.error?.message).toBe(true)
  expect(onSelect).toHaveBeenCalledTimes(1)
})

test("an agent signs out without a confirmation when none is asked for", async () => {
  const onSignOut = vi.fn()
  render(<Menu onSignOut={onSignOut} />)
  const result = await agent.act({ steps: [{ ref: "Account: Ana Ruiz", action: "press", args: ["Sign out"] }] })
  expect(result.ok, result.error?.message).toBe(true)
  expect(onSignOut).toHaveBeenCalledTimes(1)
})

test("with a confirmation, the sign-out confirm carries data-agent-confirm: refused, then approved", async () => {
  const onSignOut = vi.fn()
  render(
    <Menu
      onSignOut={onSignOut}
      confirmSignOut={{
        title: "Sign out?",
        confirmLabel: "Sign out now",
        agentConfirm: "Signs you out of this device",
      }}
    />,
  )
  const ask = await agent.act({ steps: [{ ref: "Account: Ana Ruiz", action: "press", args: ["Sign out"] }] })
  expect(ask.ok, ask.error?.message).toBe(true)
  const dialog = await screen.findByRole("alertdialog", { name: "Sign out?" })
  expect(dialog.querySelector("[data-agent-confirm]")?.getAttribute("data-agent-confirm")).toBe(
    "Signs you out of this device",
  )
  const confirm = { steps: [{ ref: "Sign out?", action: "press", args: ["Sign out now"] }] }
  expect((await agent.act(confirm)).ok).toBe(false)
  expect(onSignOut).not.toHaveBeenCalled()
  await agent.act({ steps: [{ ref: "Account: Ana Ruiz", action: "press", args: ["Sign out"] }] })
  await screen.findByRole("alertdialog")
  approve = true
  const done = await agent.act(confirm)
  expect(done.ok, done.error?.message).toBe(true)
  expect(onSignOut).toHaveBeenCalledTimes(1)
})

test("the trigger's name can be overridden", () => {
  render(<Menu labels={{ trigger: (name) => `Cuenta de ${name}` }} />)
  expect(screen.getByRole("button", { name: "Cuenta de Ana Ruiz" })).toBeTruthy()
})

test("has no axe violations closed or open", async () => {
  const { container } = render(
    <main>
      <Menu />
    </main>,
  )
  expect(await axeViolations(container)).toEqual([])
  await open()
  await settle()
  expect(await axeViolations(document.body)).toEqual([])
})
