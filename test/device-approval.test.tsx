import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { checkServer } from "@ui-sdk/core/testing"
import { createAgent } from "@ui-sdk/react/agent"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

import {
  DeviceApproval,
  type DeviceApprovalProps,
  type DeviceApprovalText,
  type DevicePermission,
} from "@/components/ui/device-approval"
import { deviceApproval } from "@/components/ui/device-approval-primitive"
import { announcementStep } from "@/components/ui/use-expiry"
import { readAnnouncements } from "@/lib/test-utils"

import { axeViolations } from "./axe"

let approve = false
const agent = createAgent({ allow: (step) => !step.confirm || approve })

const text: DeviceApprovalText = {
  description: "This device asked to connect to your workspace.",
  code: "Pairing code",
  granted: "It will be able to",
  withheld: "It asked for, but won't get",
  approve: "Approve",
  deny: "Deny",
  approveAgentConfirm: "Gives Studio laptop access to your workspace",
  error: "The decision couldn't be sent.",
  expiresIn: (_ms, formatted) => `Expires in ${formatted}`,
  expired: "This request has expired.",
  approved: "Device approved.",
  denied: "Device denied.",
}

const granted: DevicePermission[] = [
  { id: "read", label: "Read projects", description: "Every project you can open" },
  { id: "run", label: "Run jobs" },
]

const withheld: DevicePermission[] = [{ id: "admin", label: "Manage members", reason: "Your role can't grant this" }]

const compareText = { label: "Code on the device", matches: "Codes match", mismatch: "Codes don't match" }

type Harness = Partial<DeviceApprovalProps> & { onApprove?: () => unknown; onDeny?: () => unknown }

function Approval(props: Harness) {
  const merged = {
    device: { name: "Studio laptop", kind: "Desktop", detail: "Asked 2 minutes ago" },
    granted,
    withheld,
    text,
    onApprove: () => undefined,
    onDeny: () => undefined,
    ...props,
  }
  return <DeviceApproval {...(merged as DeviceApprovalProps)} />
}

beforeEach(() => {
  approve = false
})

afterEach(() => {
  vi.useRealTimers()
})

function approveButton() {
  return screen.getByRole("button", { name: "Approve" })
}

function typeCode(value: string) {
  const input = screen.getByRole<HTMLInputElement>("textbox", { name: "Code on the device" })
  act(() => {
    input.value = value
    input.setSelectionRange(value.length, value.length)
    fireEvent.input(input, { inputType: "insertText" })
  })
}

test("primitive: renders on the server as a group", () => {
  checkServer(deviceApproval, {}, `<root aria-label="Studio laptop"></root>`)
})

test("shows the device, its kind and detail, a named group, and the two permission lists apart", () => {
  render(<Approval warning="Only approve a device you're holding." />)
  const root = screen.getByRole("group", { name: "Studio laptop" })
  expect(within(root).getByRole("heading", { name: "Studio laptop" })).toBeTruthy()
  expect(within(root).getByText("Desktop")).toBeTruthy()
  expect(within(root).getByText("Asked 2 minutes ago")).toBeTruthy()
  const grantedList = within(root).getByRole("list", { name: "It will be able to" })
  expect(within(grantedList).getAllByRole("listitem")).toHaveLength(2)
  expect(grantedList.textContent).toContain("Every project you can open")
  const withheldList = within(root).getByRole("list", { name: "It asked for, but won't get" })
  expect(withheldList.textContent).toContain("Manage members")
  expect(withheldList.textContent).toContain("Your role can't grant this")
  expect(grantedList.querySelector("svg.lucide-check")).toBeTruthy()
  expect(withheldList.querySelector("svg.lucide-ban")).toBeTruthy()
  const warning = root.querySelector("[data-slot=device-approval-warning]")
  expect(warning?.getAttribute("data-tone")).toBe("warning")
  expect(warning?.textContent).toContain("Only approve a device you're holding.")
})

test("an empty list leaves its section out", () => {
  render(<Approval withheld={[]} />)
  expect(screen.queryByRole("heading", { name: "It asked for, but won't get" })).toBeNull()
})

test("Approve and Deny run their callbacks; a pending approval is busy, then says it's approved", async () => {
  const settle = { resolve: () => {} }
  const onApprove = vi.fn(() => new Promise<void>((done) => (settle.resolve = done)))
  render(<Approval onApprove={onApprove} />)
  fireEvent.click(approveButton())
  expect(onApprove).toHaveBeenCalledTimes(1)
  await waitFor(() => expect(approveButton().getAttribute("aria-busy")).toBe("true"))
  expect(screen.getByRole("group", { name: "Studio laptop" }).getAttribute("aria-busy")).toBe("true")
  expect(screen.getByRole("button", { name: "Deny" }).hasAttribute("disabled")).toBe(true)
  await act(async () => settle.resolve())
  expect((await screen.findByRole("status")).textContent).toContain("Device approved.")
  expect(screen.getByRole("group", { name: "Studio laptop" }).getAttribute("data-decided")).toBe("approve")
})

test("a rejected decision shows a live destructive alert and lets the person try again", async () => {
  const onDeny = vi.fn(() => Promise.reject(new Error("offline")))
  render(<Approval onDeny={onDeny} />)
  fireEvent.click(screen.getByRole("button", { name: "Deny" }))
  const alert = await screen.findByRole("alert")
  expect(alert.textContent).toContain("The decision couldn't be sent.")
  fireEvent.click(screen.getByRole("button", { name: "Deny" }))
  expect(onDeny).toHaveBeenCalledTimes(2)
})

test.each([
  [
    "a string",
    "This device is already paired with another account.",
    "This device is already paired with another account.",
  ],
  ["a node", <strong key="node">Your session expired.</strong>, "Your session expired."],
])("a decision rejected with %s shows it as it is in the alert", async (_case, reason, shown) => {
  render(<Approval onApprove={() => Promise.reject(reason)} />)
  fireEvent.click(approveButton())
  const alert = await screen.findByRole("alert")
  expect(alert.textContent).toBe(shown)
})

test("text.error as a function picks the message per failure, and a deny that throws shows it too", async () => {
  const onDeny = vi.fn(() => {
    throw new Error("nothing to grant")
  })
  render(
    <Approval
      text={{ ...text, error: (error) => (error instanceof Error ? `Failed: ${error.message}` : "Failed") }}
      onApprove={() => Promise.reject(new Error("offline"))}
      onDeny={onDeny}
    />,
  )
  fireEvent.click(approveButton())
  expect((await screen.findByRole("alert")).textContent).toBe("Failed: offline")
  fireEvent.click(screen.getByRole("button", { name: "Deny" }))
  await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Failed: nothing to grant"))
  expect(onDeny).toHaveBeenCalledTimes(1)
  expect(screen.getByRole("button", { name: "Deny" }).hasAttribute("disabled")).toBe(false)
})

test("approveBlocked turns Approve off, shows the reason beside the actions, describes Approve and tells an agent", async () => {
  approve = true
  const onApprove = vi.fn()
  const onDeny = vi.fn()
  const reason = "Your role can't grant any of these permissions."
  const { rerender } = render(
    <Approval approveBlocked approveBlockedReason={reason} onApprove={onApprove} onDeny={onDeny} />,
  )
  expect(approveButton().getAttribute("aria-disabled")).toBe("true")
  const shown = document.querySelector<HTMLElement>("[data-slot=device-approval-blocked]")
  expect(shown?.textContent).toBe(reason)
  expect(approveButton().getAttribute("aria-describedby")).toBe(shown?.id)
  fireEvent.click(approveButton())
  expect(onApprove).not.toHaveBeenCalled()
  const refused = await agent.act({ steps: [{ ref: "Approve", action: "approve" }] })
  expect(refused.ok).toBe(false)
  expect(refused.error?.message).toContain(`approve isn't available: ${reason}`)
  expect(onApprove).not.toHaveBeenCalled()
  expect(screen.getByRole("button", { name: "Deny" }).hasAttribute("disabled")).toBe(false)
  rerender(<Approval approveBlocked={false} approveBlockedReason={reason} onApprove={onApprove} onDeny={onDeny} />)
  expect(document.querySelector("[data-slot=device-approval-blocked]")).toBeNull()
  expect(approveButton().hasAttribute("aria-describedby")).toBe(false)
  const done = await agent.act({ steps: [{ ref: "Approve", action: "approve" }] })
  expect(done.ok, done.error?.message).toBe(true)
  expect(onApprove).toHaveBeenCalledTimes(1)
})

test("approveBlocked wins over a matching comparison, and without a reason an agent still hears why", async () => {
  approve = true
  render(<Approval code="BCDF-GHJK" compare="enter" compareText={compareText} approveBlocked />)
  typeCode("BCDFGHJK")
  expect(approveButton().getAttribute("aria-disabled")).toBe("true")
  expect(document.querySelector("[data-slot=device-approval-blocked]")).toBeNull()
  const refused = await agent.act({ steps: [{ ref: "Approve", action: "approve" }] })
  expect(refused.error?.message).toContain("approve isn't available: the app doesn't allow approving this request")
})

test("codeLabels reach the inner code: its copy button and how the code is spelled", () => {
  render(<Approval code="BCDFGHJK" codeLabels={{ copy: "Copiar código", spell: (groups) => groups.join(" / ") }} />)
  expect(screen.getByRole("button", { name: "Copiar código" })).toBeTruthy()
  expect(screen.getByRole("group", { name: "Pairing code" }).textContent).toContain("BCDF / GHJK")
})

test("Approve carries data-agent-confirm: an agent's approval is refused, then runs once a person approves", async () => {
  const onApprove = vi.fn()
  render(<Approval onApprove={onApprove} />)
  const mark = document.querySelector("[data-slot=device-approval-approve]")
  expect(mark?.getAttribute("data-agent-confirm")).toBe("Gives Studio laptop access to your workspace")
  const step = { steps: [{ ref: "Approve", action: "approve" }] }
  const refused = await agent.act(step)
  expect(refused.ok).toBe(false)
  expect(onApprove).not.toHaveBeenCalled()
  approve = true
  const done = await agent.act(step)
  expect(done.ok, done.error?.message).toBe(true)
  expect(onApprove).toHaveBeenCalledTimes(1)
})

test.each([
  ["no code", {}],
  ["a code shown only for display", { code: "BCDF-GHJK" }],
  ["a code shown to agents", { code: "BCDF-GHJK", agentHidden: false }],
])(
  "without compare, Approve is enabled at once with %s, and an agent's approve runs once a person confirms",
  async (_case, extra) => {
    const onApprove = vi.fn()
    render(<Approval {...extra} onApprove={onApprove} />)
    expect(approveButton().hasAttribute("aria-disabled")).toBe(false)
    expect(approveButton().hasAttribute("disabled")).toBe(false)
    expect(screen.queryByRole("textbox")).toBeNull()
    const step = { steps: [{ ref: "Approve", action: "approve" }] }
    const refused = await agent.act(step)
    expect(refused.ok).toBe(false)
    expect(refused.error?.message).not.toContain("isn't available")
    expect(onApprove).not.toHaveBeenCalled()
    approve = true
    const done = await agent.act(step)
    expect(done.ok, done.error?.message).toBe(true)
    expect(onApprove).toHaveBeenCalledTimes(1)
  },
)

test("without compare, a person's press approves at once", () => {
  const onApprove = vi.fn()
  render(<Approval code="BCDF-GHJK" onApprove={onApprove} />)
  fireEvent.click(approveButton())
  expect(onApprove).toHaveBeenCalledTimes(1)
})

test("without compare, only expiry turns Approve off", async () => {
  vi.useFakeTimers({ now: new Date("2026-11-26T10:00:00Z") })
  render(<Approval code="BCDF-GHJK" expiresAt={Date.now() + 2000} />)
  expect(approveButton().hasAttribute("aria-disabled")).toBe(false)
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000)
  })
  expect(approveButton().getAttribute("aria-disabled")).toBe("true")
})

test("an agent denies through the block, with no person needed", async () => {
  const onDeny = vi.fn()
  render(<Approval onDeny={onDeny} />)
  const entry = agent.snapshot().find((candidate) => !candidate.offPage && candidate.label === "Studio laptop")
  expect(entry).toMatchObject({ component: "device-approval", actions: ["deny"], expired: false, decided: null })
  const result = await agent.act({ steps: [{ ref: "Studio laptop", action: "deny" }] })
  expect(result.ok, result.error?.message).toBe(true)
  expect(onDeny).toHaveBeenCalledTimes(1)
  const again = await agent.act({ steps: [{ ref: "Studio laptop", action: "deny" }] })
  expect(again.error?.message).toContain("deny isn't available: the device was already denied")
})

test("enter: Approve waits until the typed code matches, and tells an agent why", async () => {
  approve = true
  const onApprove = vi.fn()
  const onMatchChange = vi.fn()
  render(
    <Approval
      code="BCDF-GHJK"
      compare="enter"
      compareText={compareText}
      onMatchChange={onMatchChange}
      onApprove={onApprove}
    />,
  )
  expect(approveButton().getAttribute("aria-disabled")).toBe("true")
  const refused = await agent.act({ steps: [{ ref: "Approve", action: "approve" }] })
  expect(refused.error?.message).toContain("approve isn't available: the typed code doesn't match the device's code")
  typeCode("bcdfghjx")
  expect(approveButton().getAttribute("aria-disabled")).toBe("true")
  typeCode("bcdfghjk")
  expect(onMatchChange).toHaveBeenLastCalledWith(true)
  expect(approveButton().hasAttribute("aria-disabled")).toBe(false)
  fireEvent.click(approveButton())
  expect(onApprove).toHaveBeenCalledTimes(1)
})

test("confirm: Approve waits for the person to say the codes match", async () => {
  approve = true
  const onConfirm = vi.fn()
  render(
    <Approval
      code="BCDFGHJK"
      compare="confirm"
      compareText={{ matches: "They match", mismatch: "They're different" }}
      onConfirm={onConfirm}
      agentHidden={false}
    />,
  )
  const refused = await agent.act({ steps: [{ ref: "Approve", action: "approve" }] })
  expect(refused.error?.message).toContain("approve isn't available: the person hasn't confirmed that the codes match")
  fireEvent.click(screen.getByRole("button", { name: "They're different" }))
  expect(onConfirm).toHaveBeenLastCalledWith(false)
  expect(approveButton().getAttribute("aria-disabled")).toBe("true")
  fireEvent.click(screen.getByRole("button", { name: "They match" }))
  expect(approveButton().hasAttribute("aria-disabled")).toBe(false)
})

test("the code and its comparison are hidden from agents by default, and agentHidden={false} shows them", async () => {
  const { unmount } = render(<Approval code="BCDFGHJK" compare="enter" compareText={compareText} />)
  const hidden = JSON.stringify([
    agent.snapshot().filter((entry) => !entry.offPage),
    await agent.query({ text: "BCDF" }),
  ])
  expect(hidden).not.toContain("BCDF")
  expect(hidden).not.toContain("Code on the device")
  const typed = await agent.act({ steps: [{ ref: "Code on the device", action: "setValue", args: ["BCDFGHJK"] }] })
  expect(typed.ok).toBe(false)
  unmount()
  render(<Approval code="BCDFGHJK" agentHidden={false} />)
  const shown = agent.snapshot().find((entry) => !entry.offPage && entry.label === "Pairing code")
  expect(shown).toMatchObject({ code: "BCDF-GHJK" })
})

function listenToAnnouncements() {
  const heard: string[] = []
  const observer = new MutationObserver(() => {
    const said = readAnnouncements().polite
    if (said && said !== heard.at(-1)) heard.push(said)
  })
  observer.observe(document.body, { subtree: true, childList: true, characterData: true })
  return { heard, stop: () => observer.disconnect() }
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

test("the countdown ticks each second, announces once a minute and every ten seconds at the end, then expires once", async () => {
  vi.useFakeTimers({ now: new Date("2026-11-26T10:00:00Z") })
  const onExpire = vi.fn()
  const onApprove = vi.fn()
  const announcements = listenToAnnouncements()
  render(<Approval expiresAt={Date.now() + 125_000} onExpire={onExpire} onApprove={onApprove} />)
  const timer = screen.getByRole("timer")
  expect(timer.textContent).toBe("Expires in 2:05")
  await advance(1000)
  expect(timer.textContent).toBe("Expires in 2:04")
  await advance(4000)
  expect(timer.textContent).toBe("Expires in 2:00")
  await advance(100_000)
  expect(timer.textContent).toBe("Expires in 0:20")
  expect(onExpire).not.toHaveBeenCalled()
  await advance(20_000)
  expect(onExpire).toHaveBeenCalledTimes(1)
  await advance(200)
  announcements.stop()
  expect(announcements.heard).toEqual([
    "Expires in 2:00",
    "Expires in 1:00",
    "Expires in 0:30",
    "Expires in 0:20",
    "Expires in 0:10",
    "This request has expired.",
  ])
  expect(screen.queryByRole("timer")).toBeNull()
  expect(document.querySelector("[data-slot=device-approval-expired]")?.textContent).toBe("This request has expired.")
  expect(approveButton().getAttribute("aria-disabled")).toBe("true")
  expect(screen.getByRole("button", { name: "Deny" }).hasAttribute("disabled")).toBe(true)
  fireEvent.click(approveButton())
  expect(onApprove).not.toHaveBeenCalled()
  await advance(60_000)
  expect(onExpire).toHaveBeenCalledTimes(1)
  vi.useRealTimers()
  approve = true
  const result = await agent.act({ steps: [{ ref: "Approve", action: "approve" }] })
  expect(result.ok).toBe(false)
  expect(result.error?.message).toContain("approve isn't available: the request has expired")
  expect(onApprove).not.toHaveBeenCalled()
})

test("the announcement steps fall on whole minutes, then on 30, 20 and 10 seconds", () => {
  expect([125, 120, 61, 60, 31, 30, 29, 21, 20, 10, 1, 0].map(announcementStep)).toEqual([
    180,
    120,
    120,
    60,
    60,
    30,
    30,
    30,
    20,
    10,
    10,
    null,
  ])
})

test("a request that has already expired calls onExpire once on mount, and a Date works as expiresAt", () => {
  const onExpire = vi.fn()
  render(<Approval expiresAt={new Date(Date.now() - 1000)} onExpire={onExpire} />)
  expect(onExpire).toHaveBeenCalledTimes(1)
  expect(document.querySelector("[data-slot=device-approval-expired]")?.textContent).toBe("This request has expired.")
})

test("no countdown timer runs while the page is hidden", async () => {
  vi.useFakeTimers({ now: new Date("2026-11-26T10:00:00Z") })
  render(<Approval expiresAt={Date.now() + 300_000} />)
  const before = vi.getTimerCount()
  expect(before).toBeGreaterThan(0)
  Object.defineProperty(document, "hidden", { value: true, configurable: true })
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"))
  })
  expect(vi.getTimerCount()).toBe(before - 2)
  Object.defineProperty(document, "hidden", { value: false, configurable: true })
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"))
  })
  expect(vi.getTimerCount()).toBe(before)
})

test("actions replaces Approve and Deny, and gets the expiry and match state", () => {
  const actions = vi.fn(({ approveBlocked }: { approveBlocked: boolean }) => (
    <span data-testid="own">{approveBlocked ? "blocked" : "open"}</span>
  ))
  render(
    <Approval
      code="BCDFGHJK"
      compare="enter"
      compareText={compareText}
      actions={actions}
      onApprove={undefined}
      onDeny={undefined}
    />,
  )
  expect(screen.queryByRole("button", { name: "Approve" })).toBeNull()
  expect(screen.getByTestId("own").textContent).toBe("blocked")
  expect(actions).toHaveBeenLastCalledWith({
    expired: false,
    codesMatch: null,
    approveBlocked: true,
    selected: [],
    confirmed: [],
  })
  typeCode("BCDFGHJK")
  expect(screen.getByTestId("own").textContent).toBe("open")
})

test("actions get approveBlocked from the app's block too, and the reason still shows", () => {
  const actions = vi.fn(({ approveBlocked }: { approveBlocked: boolean }) => (
    <span data-testid="own">{approveBlocked ? "blocked" : "open"}</span>
  ))
  const { rerender } = render(
    <Approval
      actions={actions}
      onApprove={undefined}
      onDeny={undefined}
      approveBlocked
      approveBlockedReason="Nothing to grant."
    />,
  )
  expect(screen.getByTestId("own").textContent).toBe("blocked")
  expect(document.querySelector("[data-slot=device-approval-blocked]")?.textContent).toBe("Nothing to grant.")
  rerender(<Approval actions={actions} onApprove={undefined} onDeny={undefined} />)
  expect(screen.getByTestId("own").textContent).toBe("open")
})

test("every control is named, and there are no axe violations", async () => {
  const { container } = render(
    <Approval
      code="BCDFGHJK"
      compare="enter"
      compareText={compareText}
      warning="Check the device."
      expiresAt={Date.now() + 60_000}
    />,
  )
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  const labels = components.map((entry) => entry.label)
  for (const label of ["Studio laptop", "Approve", "Deny"]) expect(labels).toContain(label)
  expect(await axeViolations(container)).toEqual([])
})
