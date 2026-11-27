import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { useState } from "react"
import { beforeEach, expect, test, vi } from "vitest"

import {
  DeviceApproval,
  type DeviceApprovalProps,
  type DeviceApprovalText,
  type DeviceConsentItem,
} from "@/components/ui/device-approval"
import { SecretFingerprint } from "@/components/ui/secret-fingerprint"

import { axeViolations } from "./axe"

let approve = false
const agent = createAgent({ allow: (step) => !step.confirm || approve })

beforeEach(() => {
  approve = false
})

const text: DeviceApprovalText = {
  items: "Keys to upload",
  nothingSelected: "Choose at least one key to upload.",
  unconfirmed: (labels) => `Confirm the replacement of ${labels.join(", ")}.`,
  granted: "It will be able to",
  withheld: "It won't get",
  approve: "Approve",
  deny: "Deny",
  approveAgentConfirm: "Uploads the chosen keys to your account",
  error: "The decision couldn't be sent.",
  approved: "Keys uploaded.",
}

const items: DeviceConsentItem[] = [
  {
    id: "openai",
    label: "OpenAI key",
    description: "From ~/.config/tools",
    detail: <SecretFingerprint fingerprint="1a2b" />,
    marker: { label: "Replace", confirm: "Replace the existing key" },
  },
  { id: "github", label: "GitHub token", detail: <SecretFingerprint fingerprint="9f3c" /> },
  { id: "stripe", label: "Stripe key", disabled: { reason: "Your role can't upload payment keys" } },
]

type Harness = Partial<DeviceApprovalProps> & { onApprove?: DeviceApprovalProps["onApprove"] }

function Approval(props: Harness) {
  const merged = {
    device: { name: "Studio laptop", kind: "Desktop" },
    items,
    text,
    onApprove: () => undefined,
    onDeny: () => undefined,
    ...props,
  }
  return <DeviceApproval {...(merged as DeviceApprovalProps)} />
}

function AppTogglesSelection() {
  const [selected, setSelected] = useState<string[]>(["openai"])
  return (
    <>
      <button type="button" onClick={() => setSelected((ids) => (ids.length ? [] : ["openai"]))}>
        Toggle from the app
      </button>
      <Approval selected={selected} onSelectedChange={setSelected} />
    </>
  )
}

const checkbox = (name: string) => screen.getByRole("checkbox", { name })
const approveButton = () => screen.getByRole("button", { name: "Approve" })
const blockedReason = () => document.querySelector<HTMLElement>("[data-slot=device-approval-blocked]")
const entry = (component: string) =>
  agent.snapshot().find((candidate) => candidate.component === component && !candidate.offPage)
const ref = (component: string) => entry(component)?.ref ?? `no ${component}`

test("lists the items under their heading, with the detail, the marker badge and a disabled item's reason", () => {
  render(<Approval />)
  const group = screen.getByRole("group", { name: "Keys to upload" })
  expect(within(group).getByRole("heading", { name: "Keys to upload" })).toBeTruthy()
  const openai = checkbox("OpenAI key")
  const row = openai.closest<HTMLElement>("[data-slot=checkbox-row]")!
  expect(row.textContent).toContain("•••• 1a2b")
  expect(within(row).getByText("Replace").closest("[data-slot=badge]")?.getAttribute("data-tone")).toBe("warning")
  const stripe = checkbox("Stripe key")
  expect(stripe.getAttribute("aria-disabled")).toBe("true")
  expect(document.getElementById(stripe.getAttribute("aria-describedby") ?? "")?.textContent).toBe(
    "Your role can't upload payment keys",
  )
})

test("Approve waits while nothing is selected, and says why beside the actions", async () => {
  const user = userEvent.setup()
  render(<Approval />)
  expect(approveButton().getAttribute("aria-disabled")).toBe("true")
  expect(blockedReason()?.textContent).toBe("Choose at least one key to upload.")
  expect(approveButton().getAttribute("aria-describedby")).toBe(blockedReason()?.id)
  await user.click(checkbox("GitHub token"))
  expect(approveButton().hasAttribute("aria-disabled")).toBe(false)
  expect(blockedReason()).toBeNull()
})

test("a selected marked item shows its confirmation, and Approve waits until it's ticked or deselected", async () => {
  const user = userEvent.setup()
  render(<Approval />)
  expect(screen.queryByRole("checkbox", { name: "Replace the existing key" })).toBeNull()
  await user.click(checkbox("OpenAI key"))
  const confirm = checkbox("Replace the existing key")
  expect(document.getElementById(confirm.getAttribute("aria-describedby") ?? "")?.textContent).toBe("OpenAI key")
  expect(approveButton().getAttribute("aria-disabled")).toBe("true")
  expect(blockedReason()?.textContent).toBe("Confirm the replacement of OpenAI key.")
  await user.click(confirm)
  expect(approveButton().hasAttribute("aria-disabled")).toBe(false)
  await user.click(checkbox("Replace the existing key"))
  expect(approveButton().getAttribute("aria-disabled")).toBe("true")
  await user.click(checkbox("GitHub token"))
  await user.click(checkbox("OpenAI key"))
  expect(screen.queryByRole("checkbox", { name: "Replace the existing key" })).toBeNull()
  expect(approveButton().hasAttribute("aria-disabled")).toBe(false)
})

test("the confirmation sits in a group marked data-agent-confirm, apart from the items", async () => {
  const user = userEvent.setup()
  render(<Approval defaultSelected={["openai"]} />)
  const group = screen.getByRole("group", { name: "Confirmations" })
  expect(group.getAttribute("data-agent-confirm")).toBe("Confirms replacing something that already exists")
  await waitFor(() => expect(within(group).getByRole("checkbox", { name: "Replace the existing key" })).toBeTruthy())
  expect(checkbox("OpenAI key").closest("[data-agent-confirm]")).toBeNull()
  await user.click(checkbox("Replace the existing key"))
  expect(checkbox("Replace the existing key").closest("[data-agent-confirm]")).toBe(group)
})

test("onApprove gets the selected ids and the confirmed marked ones", async () => {
  const user = userEvent.setup()
  const onApprove = vi.fn()
  render(<Approval onApprove={onApprove} />)
  await user.click(checkbox("OpenAI key"))
  await user.click(checkbox("GitHub token"))
  await user.click(checkbox("Replace the existing key"))
  await user.click(approveButton())
  expect(onApprove).toHaveBeenCalledWith({ selected: ["openai", "github"], confirmed: ["openai"] })
})

test("deselecting a marked item clears its confirmation: selecting it again needs a new tick", async () => {
  const user = userEvent.setup()
  const onApprove = vi.fn()
  render(<Approval onApprove={onApprove} />)
  await user.click(checkbox("OpenAI key"))
  await user.click(checkbox("Replace the existing key"))
  await user.click(checkbox("OpenAI key"))
  await user.click(checkbox("OpenAI key"))
  expect(checkbox("Replace the existing key").getAttribute("aria-checked")).toBe("false")
  expect(approveButton().getAttribute("aria-disabled")).toBe("true")
  await user.click(approveButton())
  expect(onApprove).not.toHaveBeenCalled()
  await user.click(checkbox("Replace the existing key"))
  await user.click(approveButton())
  expect(onApprove).toHaveBeenCalledWith({ selected: ["openai"], confirmed: ["openai"] })
})

test("a controlled selection that drops a marked item also clears its confirmation", async () => {
  const user = userEvent.setup()
  render(<AppTogglesSelection />)
  await user.click(checkbox("Replace the existing key"))
  expect(approveButton().hasAttribute("aria-disabled")).toBe(false)
  await user.click(screen.getByRole("button", { name: "Toggle from the app" }))
  await user.click(screen.getByRole("button", { name: "Toggle from the app" }))
  expect(checkbox("Replace the existing key").getAttribute("aria-checked")).toBe("false")
  expect(approveButton().getAttribute("aria-disabled")).toBe("true")
})

test("the zero-argument onApprove still works", async () => {
  const user = userEvent.setup()
  let called = 0
  render(
    <Approval
      items={undefined}
      onApprove={() => {
        called += 1
      }}
    />,
  )
  await user.click(approveButton())
  expect(called).toBe(1)
})

test("items sit beside granted and withheld, each under its own heading", () => {
  render(
    <Approval
      granted={[{ id: "read", label: "Read your keys" }]}
      withheld={[{ id: "admin", label: "Manage members" }]}
    />,
  )
  expect(screen.getByRole("group", { name: "Keys to upload" })).toBeTruthy()
  expect(screen.getByRole("list", { name: "It will be able to" })).toBeTruthy()
  expect(screen.getByRole("list", { name: "It won't get" })).toBeTruthy()
})

test("Tab moves through the item checkboxes, Space ticks one, and Tab reaches its confirmation next", async () => {
  const user = userEvent.setup()
  render(<Approval />)
  await user.tab()
  expect(document.activeElement).toBe(checkbox("OpenAI key"))
  await user.keyboard(" ")
  await user.tab()
  expect(document.activeElement).toBe(checkbox("GitHub token"))
  await user.tab()
  expect(document.activeElement).toBe(checkbox("Replace the existing key"))
  await user.keyboard(" ")
  expect(checkbox("Replace the existing key").getAttribute("aria-checked")).toBe("true")
})

test("agents select items by label in any case or by id, with no person needed, and read what's selected", async () => {
  const onSelectedChange = vi.fn()
  render(<Approval onSelectedChange={onSelectedChange} />)
  expect(entry("device-approval-items")).toMatchObject({ label: "Keys to upload", actions: ["select"], selected: [] })
  const byLabel = await agent.act({
    steps: [{ ref: ref("device-approval-items"), action: "select", args: ["github TOKEN"] }],
  })
  expect(byLabel.ok, byLabel.error?.message).toBe(true)
  const byId = await agent.act({ steps: [{ ref: ref("device-approval-items"), action: "select", args: ["openai"] }] })
  expect(byId.ok, byId.error?.message).toBe(true)
  expect(onSelectedChange).toHaveBeenLastCalledWith(["github", "openai"], expect.objectContaining({ source: "agent" }))
  expect(entry("device-approval-items")?.selected).toEqual(["OpenAI key", "GitHub token"])
  const off = await agent.act({
    steps: [{ ref: ref("device-approval-items"), action: "select", args: ["github", false] }],
  })
  expect(off.ok, off.error?.message).toBe(true)
  expect(entry("device-approval-items")?.selected).toEqual(["OpenAI key"])
})

test("an agent's confirmMarker needs a person: refused, then approved; and its approve refuses with the reason", async () => {
  const onApprove = vi.fn()
  render(<Approval onApprove={onApprove} />)
  await agent.act({ steps: [{ ref: ref("device-approval-items"), action: "select", args: ["OpenAI key"] }] })
  const markers = entry("device-approval-markers")
  expect(markers).toMatchObject({
    label: "Confirmations",
    actions: ["confirmMarker"],
    confirm: "Confirms replacing something that already exists",
    items: [{ value: "openai", label: "OpenAI key" }],
  })
  const blocked = await agent.act({ steps: [{ ref: "Approve", action: "approve" }] })
  expect(blocked.ok).toBe(false)
  expect(onApprove).not.toHaveBeenCalled()
  approve = true
  const stillBlocked = await agent.act({ steps: [{ ref: "Approve", action: "approve" }] })
  expect(stillBlocked.error?.message).toContain("approve isn't available: Confirm the replacement of OpenAI key.")
  approve = false
  const step = { steps: [{ ref: ref("device-approval-markers"), action: "confirmMarker", args: ["openai"] }] }
  const refused = await agent.act(step)
  expect(refused.ok).toBe(false)
  expect(checkbox("Replace the existing key").getAttribute("aria-checked")).toBe("false")
  approve = true
  const confirmed = await agent.act(step)
  expect(confirmed.ok, confirmed.error?.message).toBe(true)
  expect(checkbox("Replace the existing key").getAttribute("aria-checked")).toBe("true")
  expect(entry("device-approval-markers")?.confirmed).toEqual(["OpenAI key"])
  const done = await agent.act({ steps: [{ ref: "Approve", action: "approve" }] })
  expect(done.ok, done.error?.message).toBe(true)
  expect(onApprove).toHaveBeenCalledWith({ selected: ["openai"], confirmed: ["openai"] })
})

test("an agent's approve with nothing selected fails with the reason from text", async () => {
  approve = true
  render(<Approval />)
  const result = await agent.act({ steps: [{ ref: "Approve", action: "approve" }] })
  expect(result.error?.message).toContain("approve isn't available: Choose at least one key to upload.")
})

test("without text for the reasons, nothing shows and an agent still hears why", async () => {
  approve = true
  render(<Approval text={{ ...text, nothingSelected: undefined, unconfirmed: undefined }} />)
  expect(blockedReason()).toBeNull()
  const nothing = await agent.act({ steps: [{ ref: "Approve", action: "approve" }] })
  expect(nothing.error?.message).toContain("approve isn't available: nothing is selected")
  await agent.act({ steps: [{ ref: ref("device-approval-items"), action: "select", args: ["openai"] }] })
  expect(blockedReason()).toBeNull()
  const unconfirmed = await agent.act({ steps: [{ ref: "Approve", action: "approve" }] })
  expect(unconfirmed.error?.message).toContain("approve isn't available: OpenAI key needs its confirmation ticked")
})

test("once the device is approved, the items lock and an agent's select says why", async () => {
  const user = userEvent.setup()
  render(<Approval defaultSelected={["github"]} />)
  await user.click(approveButton())
  await screen.findByText("Keys uploaded.")
  expect(checkbox("GitHub token").getAttribute("aria-disabled")).toBe("true")
  const result = await agent.act({ steps: [{ ref: ref("device-approval-items"), action: "select", args: ["openai"] }] })
  expect(result.error?.message).toContain("select isn't available: the device was already approved")
})

test("every control is named, the item checkboxes are left to the actions, and there are no axe violations", async () => {
  const { container } = render(
    <main>
      <Approval defaultSelected={["openai"]} />
    </main>,
  )
  await act(async () => {})
  const components = agent.snapshot().filter((candidate) => !candidate.offPage && candidate.component !== "more")
  for (const component of components) expect(component.label, `${component.component} has no name`).toBeTruthy()
  expect(components.some((component) => component.component === "checkbox")).toBe(false)
  expect(await axeViolations(container)).toEqual([])
})
