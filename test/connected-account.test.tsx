import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { checkServer, mount } from "@ui-sdk/core/testing"
import { createAgent } from "@ui-sdk/react/agent"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { Button } from "@/components/ui/button"
import {
  ConnectedAccount,
  useConnectedAccount,
  type ConnectedAccountProps,
  type ConnectedAccountText,
} from "@/components/ui/connected-account"
import { connectedAccount } from "@/components/ui/connected-account-primitive"
import { DeviceCodePrompt } from "@/components/ui/device-code-prompt"

import { axeViolations } from "./axe"

let approve = false
const agent = createAgent({ allow: (step) => !step.confirm || approve })

const text: ConnectedAccountText = {
  status: {
    connected: "Connected",
    pending: "Waiting for approval",
    expired: "Sign-in expired",
    disconnected: "Not connected",
  },
  connect: "Connect",
  reconnect: "Sign in again",
  disconnect: "Disconnect",
  cancel: "Cancel sign-in",
  disconnectTitle: "Disconnect this account?",
  disconnectConfirm: "Disconnect account",
  disconnectAgentConfirm: "Unlinks your account at the provider",
  error: "That didn't work.",
}

const facts = [
  { id: "email", label: "Account", value: "a•••@example.com" },
  { id: "plan", label: "Plan", value: "Team" },
]

function Account(props: Partial<ConnectedAccountProps>) {
  return (
    <ConnectedAccount
      provider={{ name: "Provider" }}
      status="connected"
      facts={facts}
      onConnect={() => undefined}
      onReconnect={() => undefined}
      onDisconnect={() => undefined}
      onCancel={() => undefined}
      text={text}
      {...props}
    />
  )
}

function deferred() {
  const settle = { resolve: () => {}, reject: (_error: unknown) => {} }
  const promise = new Promise<void>((resolve, reject) => {
    settle.resolve = resolve
    settle.reject = reject
  })
  return { promise, ...settle }
}

beforeEach(() => {
  approve = false
})
afterEach(cleanup)

function panel() {
  return screen.getByRole("group", { name: "Provider" })
}

async function failsWith(action: string, message: string) {
  const result = await agent.act({ steps: [{ ref: "Provider", action }] })
  expect(result.ok, action).toBe(false)
  expect(result.error?.message).toContain(message)
}

test("primitive: renders on the server as a group with its status", () => {
  checkServer(connectedAccount, { status: "expired" }, `<root aria-label="Provider"></root>`)
})

test.each([
  ["connected", "success", "Connected"],
  ["pending", "info", "Waiting for approval"],
  ["expired", "warning", "Sign-in expired"],
  ["disconnected", "neutral", "Not connected"],
] as const)("%s shows a %s status pill from text", (status, tone, label) => {
  render(<Account status={status} />)
  const pill = panel().querySelector("[data-slot=connected-account-status]")
  expect(pill?.getAttribute("data-tone")).toBe(tone)
  expect(pill?.textContent).toBe(label)
  expect(panel().getAttribute("data-status")).toBe(status)
})

test("names the panel by the provider's heading, and lists the facts as terms and details", () => {
  render(<Account description="Syncs your files" />)
  expect(within(panel()).getByRole("heading", { level: 3, name: "Provider" })).toBeTruthy()
  expect(panel().textContent).toContain("Syncs your files")
  const terms = panel().querySelectorAll("dt")
  expect([...terms].map((term) => term.textContent)).toEqual(["Account", "Plan"])
  expect(panel().querySelector("dd")?.textContent).toBe("a•••@example.com")
})

test.each([
  ["disconnected", ["Connect"]],
  ["connected", ["Disconnect"]],
  ["expired", ["Disconnect", "Sign in again"]],
  ["pending", ["Cancel sign-in"]],
] as const)("%s offers %j", (status, names) => {
  render(<Account status={status} />)
  const buttons = within(panel())
    .getAllByRole("button")
    .map((button) => button.textContent)
  expect(buttons).toEqual(names)
})

test("reconnectWhenConnected offers Reconnect while connected too", () => {
  render(<Account reconnectWhenConnected />)
  expect(within(panel()).getByRole("button", { name: "Sign in again" })).toBeTruthy()
})

test("a pending Connect is busy with the others off, and a rejection shows the error in a live destructive alert", async () => {
  const flow = deferred()
  const onConnect = vi.fn(() => flow.promise)
  render(<Account status="disconnected" onConnect={onConnect} />)
  fireEvent.click(screen.getByRole("button", { name: "Connect" }))
  expect(onConnect).toHaveBeenCalledTimes(1)
  await waitFor(() => expect(screen.getByRole("button", { name: "Connect" }).getAttribute("aria-busy")).toBe("true"))
  expect(panel().getAttribute("aria-busy")).toBe("true")
  await act(async () => flow.reject(new Error("offline")))
  const alert = await screen.findByRole("alert")
  expect(alert.getAttribute("data-tone")).toBe("destructive")
  expect(alert.textContent).toBe("That didn't work.")
  expect(panel().hasAttribute("aria-busy")).toBe(false)
})

test("a rejection with a string or node shows as it is, and text.error can be a function of the error and action", async () => {
  const { unmount } = render(<Account status="expired" onReconnect={() => Promise.reject("The provider is down.")} />)
  fireEvent.click(screen.getByRole("button", { name: "Sign in again" }))
  expect((await screen.findByRole("alert")).textContent).toBe("The provider is down.")
  unmount()
  render(
    <Account
      status="disconnected"
      onConnect={() => Promise.reject(new Error("nope"))}
      text={{ ...text, error: (error, action) => `${action}: ${error instanceof Error ? error.message : ""}` }}
    />,
  )
  fireEvent.click(screen.getByRole("button", { name: "Connect" }))
  expect((await screen.findByRole("alert")).textContent).toBe("connect: nope")
})

test("Disconnect asks first; the confirm carries data-agent-confirm and runs onDisconnect", async () => {
  const onDisconnect = vi.fn(() => Promise.resolve())
  render(<Account onDisconnect={onDisconnect} />)
  fireEvent.click(screen.getByRole("button", { name: "Disconnect" }))
  const dialog = await screen.findByRole("alertdialog", { name: "Disconnect this account?" })
  const confirm = within(dialog).getByRole("button", { name: "Disconnect account" })
  expect(confirm.getAttribute("data-agent-confirm")).toBe("Unlinks your account at the provider")
  expect(onDisconnect).not.toHaveBeenCalled()
  fireEvent.click(confirm)
  await waitFor(() => expect(onDisconnect).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
})

test("an agent's disconnect opens the confirmation, whose confirm needs a person: refused, then approved", async () => {
  const onDisconnect = vi.fn(() => Promise.resolve())
  render(<Account onDisconnect={onDisconnect} />)
  const ask = await agent.act({ steps: [{ ref: "Provider", action: "disconnect" }] })
  expect(ask.ok, ask.error?.message).toBe(true)
  await screen.findByRole("alertdialog")
  const confirm = { steps: [{ ref: "Disconnect this account?", action: "press", args: ["Disconnect account"] }] }
  expect((await agent.act(confirm)).ok).toBe(false)
  expect(onDisconnect).not.toHaveBeenCalled()
  approve = true
  const done = await agent.act(confirm)
  expect(done.ok, done.error?.message).toBe(true)
  expect(onDisconnect).toHaveBeenCalledTimes(1)
})

test("agents connect and reconnect through the panel", async () => {
  const onConnect = vi.fn()
  const onReconnect = vi.fn()
  const { rerender } = render(<Account status="disconnected" onConnect={onConnect} onReconnect={onReconnect} />)
  const entry = agent.snapshot().find((candidate) => !candidate.offPage && candidate.label === "Provider")
  expect(entry).toMatchObject({
    component: "connected-account",
    status: "disconnected",
    actions: ["connect", "reconnect", "disconnect", "cancel"],
  })
  expect((await agent.act({ steps: [{ ref: "Provider", action: "connect" }] })).ok).toBe(true)
  expect(onConnect).toHaveBeenCalledTimes(1)
  rerender(<Account status="expired" onConnect={onConnect} onReconnect={onReconnect} />)
  expect((await agent.act({ steps: [{ ref: "Provider", action: "reconnect" }] })).ok).toBe(true)
  expect(onReconnect).toHaveBeenCalledTimes(1)
})

test("each action refuses with why in a status that doesn't offer it, and the status stays", async () => {
  const onConnect = vi.fn()
  const onCancel = vi.fn()
  const { rerender } = render(<Account status="connected" onConnect={onConnect} onCancel={onCancel} />)
  await failsWith("connect", "connect isn't available: the account is connected")
  await failsWith("reconnect", "reconnect isn't available: the account is connected")
  await failsWith("cancel", "cancel isn't available: the account is connected")
  rerender(<Account status="disconnected" onConnect={onConnect} onCancel={onCancel} />)
  await failsWith("disconnect", "disconnect isn't available: the account isn't connected")
  await failsWith("cancel", "cancel isn't available: the account isn't connected")
  rerender(<Account status="pending" onConnect={onConnect} onCancel={onCancel} />)
  await failsWith("connect", "connect isn't available: a sign-in is waiting for approval on the provider")
  await failsWith("disconnect", "disconnect isn't available: a sign-in is waiting for approval on the provider")
  rerender(<Account status="expired" onConnect={onConnect} onCancel={onCancel} />)
  await failsWith("cancel", "cancel isn't available: the sign-in has expired")
  expect(onConnect).not.toHaveBeenCalled()
  expect(onCancel).not.toHaveBeenCalled()
  expect(panel().getAttribute("data-status")).toBe("expired")
  expect(screen.queryByRole("alertdialog")).toBeNull()
})

test("an action without its callback, or while another runs, refuses with why", async () => {
  const flow = deferred()
  render(<Account status="pending" onCancel={() => flow.promise} onConnect={undefined} />)
  fireEvent.click(screen.getByRole("button", { name: "Cancel sign-in" }))
  await failsWith("cancel", "cancel isn't available while cancel is running")
  await act(async () => flow.resolve())
  cleanup()
  render(<Account status="disconnected" onConnect={undefined} />)
  await failsWith("connect", "connect isn't available: the panel has no onConnect")
  expect(screen.queryByRole("button", { name: "Connect" })).toBeNull()
})

test("Cancel beside the waiting content abandons a pending sign-in, busy while its Promise runs", async () => {
  const flow = deferred()
  const onCancel = vi.fn(() => flow.promise)
  render(<Account status="pending" waiting={<p>Approve it on the provider</p>} onCancel={onCancel} />)
  const waiting = panel().querySelector("[data-slot=connected-account-waiting]")
  expect(waiting?.textContent).toContain("Approve it on the provider")
  const cancel = within(waiting as HTMLElement).getByRole("button", { name: "Cancel sign-in" })
  fireEvent.click(cancel)
  expect(onCancel).toHaveBeenCalledTimes(1)
  await waitFor(() => expect(cancel.getAttribute("aria-busy")).toBe("true"))
  await act(async () => flow.resolve())
  await waitFor(() => expect(cancel.hasAttribute("aria-busy")).toBe(false))
})

test("without text.cancel there is no built-in Cancel, and the waiting function's cancel does it", async () => {
  const onCancel = vi.fn()
  render(
    <Account
      status="pending"
      text={{ ...text, cancel: undefined }}
      onCancel={onCancel}
      waiting={({ cancel, pending }) => (
        <DeviceCodePrompt
          code="WDJBMJHT"
          verificationUri="https://provider.example/device"
          text={{ instructions: (link) => <>Go to {link}</>, open: "Open" }}
          actions={
            <Button variant="outline" loading={pending === "cancel"} onClick={cancel}>
              Stop
            </Button>
          }
        />
      )}
    />,
  )
  expect(screen.queryByRole("button", { name: "Cancel sign-in" })).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "Stop" }))
  expect(onCancel).toHaveBeenCalledTimes(1)
})

function CancelFromHook() {
  const { cancel, status } = useConnectedAccount()
  return (
    <Button variant="outline" onClick={(event) => cancel(event)}>
      Give up ({status})
    </Button>
  )
}

test("useConnectedAccount gives content inside the slot the same cancel", () => {
  const onCancel = vi.fn()
  render(<Account status="pending" waiting={<CancelFromHook />} onCancel={onCancel} />)
  fireEvent.click(screen.getByRole("button", { name: "Give up (pending)" }))
  expect(onCancel).toHaveBeenCalledTimes(1)
})

test("useConnectedAccount outside a panel throws", () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined)
  expect(() => render(<CancelFromHook />)).toThrow("useConnectedAccount must be called inside a ConnectedAccount.")
  vi.restoreAllMocks()
})

test("an agent cancels a pending sign-in, and a failed cancel shows its error", async () => {
  const onCancel = vi.fn(() => Promise.reject(new Error("still linking")))
  render(<Account status="pending" onCancel={onCancel} />)
  const result = await agent.act({ steps: [{ ref: "Provider", action: "cancel" }] })
  expect(onCancel).toHaveBeenCalledTimes(1)
  expect(result.ok).toBe(false)
  expect((await screen.findByRole("alert")).textContent).toBe("That didn't work.")
})

test("actions replaces the buttons, or adds to them as a function", () => {
  const { rerender } = render(<Account actions={<Button>Manage</Button>} />)
  expect(
    within(panel())
      .getAllByRole("button")
      .map((button) => button.textContent),
  ).toEqual(["Manage"])
  rerender(
    <Account
      actions={({ buttons, status }) => (
        <>
          <Button variant="ghost">Manage {status}</Button>
          {buttons}
        </>
      )}
    />,
  )
  expect(
    within(panel())
      .getAllByRole("button")
      .map((button) => button.textContent),
  ).toEqual(["Manage connected", "Disconnect"])
})

test("the primitive's actions refuse an imperative call outside their status", () => {
  const view = mount(
    connectedAccount,
    { status: "connected", onCancel: () => undefined },
    `<root aria-label="P"></root>`,
  )
  expect(() => view.api.cancel()).toThrow("cancel isn't available: the account is connected")
  view.unmount()
})

test("the pending sign-in with a DeviceCodePrompt keeps the code from agents, and there are no axe violations", async () => {
  const { container } = render(
    <main>
      <Account
        status="pending"
        waiting={
          <DeviceCodePrompt
            code="WDJBMJHT"
            verificationUri="https://provider.example/device"
            text={{ instructions: (link) => <>Go to {link} and enter this code.</>, open: "Open sign-in page" }}
          />
        }
      />
    </main>,
  )
  const snapshot = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  const everything = JSON.stringify([snapshot, await agent.query({ text: "WDJB" })])
  expect(everything).not.toContain("WDJB")
  expect(everything).not.toContain("provider.example")
  for (const entry of snapshot) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  expect(await axeViolations(container)).toEqual([])
})
