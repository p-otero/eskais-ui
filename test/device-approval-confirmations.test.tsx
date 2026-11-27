import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { beforeEach, expect, test, vi } from "vitest"

import {
  DeviceApproval,
  type DeviceApprovalProps,
  type DeviceApprovalText,
  type DeviceConsentItem,
} from "@/components/ui/device-approval"

import { axeViolations } from "./axe"

let approve = false
const agent = createAgent({ allow: (step) => !step.confirm || approve })

beforeEach(() => {
  approve = false
})

const text: DeviceApprovalText<never> = {
  items: "Keys to upload",
  nothingSelected: "Choose at least one key to upload.",
  approve: "Approve",
  deny: "Deny",
  approveAgentConfirm: "Uploads the chosen keys to your account",
  error: "The decision couldn't be sent.",
}

const items: DeviceConsentItem[] = [
  {
    id: "openai",
    label: "OpenAI key",
    marker: { label: "Replace", confirm: ["Replace the existing key", "Revoke the old key"] },
  },
  { id: "github", label: "GitHub token" },
]

type Harness = Partial<DeviceApprovalProps> & { onApprove?: DeviceApprovalProps["onApprove"] }

function Approval(props: Harness) {
  const merged = {
    device: { name: "Studio laptop" },
    items,
    text,
    onApprove: () => undefined,
    onDeny: () => undefined,
    ...props,
  }
  return <DeviceApproval {...(merged as DeviceApprovalProps)} />
}

const checkbox = (name: string) => screen.getByRole("checkbox", { name })
const approveButton = () => screen.getByRole("button", { name: "Approve" })
const blockedReason = () => document.querySelector<HTMLElement>("[data-slot=device-approval-blocked]")
const markers = () =>
  agent.snapshot().find((candidate) => candidate.component === "device-approval-markers" && !candidate.offPage)
const markersRef = () => markers()?.ref ?? "no markers"

test("a block with items only needs no permission headings, and shows none", () => {
  render(
    <DeviceApproval
      device={{ name: "Studio laptop" }}
      items={items}
      text={text}
      onApprove={() => undefined}
      onDeny={() => undefined}
    />,
  )
  expect(screen.getAllByRole("heading").map((heading) => heading.textContent)).toEqual([
    "Studio laptop",
    "Keys to upload",
  ])
  expect(document.querySelector("[data-slot=device-approval-granted]")).toBeNull()
})

test("a permission list needs its heading in text, and only then", () => {
  const granted = [{ id: "read", label: "Read your keys" }]
  const shared = { device: { name: "Laptop" }, onApprove: () => undefined, onDeny: () => undefined }
  const itemsOnly = <DeviceApproval {...shared} items={items} text={text} />
  const withHeading = <DeviceApproval {...shared} granted={granted} text={{ ...text, granted: "It will be able to" }} />
  // @ts-expect-error granted needs text.granted
  const withoutHeading = <DeviceApproval {...shared} granted={granted} text={text} />
  // @ts-expect-error withheld needs text.withheld
  const withoutWithheld = <DeviceApproval {...shared} withheld={granted} text={{ ...text, granted: "Gets" }} />
  const full: DeviceApprovalText = { ...text, granted: "Gets", withheld: "Won't get" }
  const maybe = (show: boolean) => (show ? granted : undefined)
  const optional = <DeviceApproval {...shared} granted={maybe(true)} withheld={maybe(false)} text={full} />
  expect([itemsOnly, withHeading, withoutHeading, withoutWithheld, optional]).toHaveLength(5)
})

test("a permission list without a heading renders no empty heading", () => {
  render(<Approval items={undefined} granted={[{ id: "read", label: "Read your keys" }]} />)
  const section = document.querySelector<HTMLElement>("[data-slot=device-approval-granted]")!
  expect(within(section).queryByRole("heading")).toBeNull()
  expect(section.hasAttribute("aria-labelledby")).toBe(false)
  expect(within(section).getByText("Read your keys")).toBeTruthy()
})

test("each confirmation of a selected marked item is its own checkbox in the confirmations group", async () => {
  const user = userEvent.setup()
  render(<Approval />)
  await user.click(checkbox("OpenAI key"))
  const group = screen.getByRole("group", { name: "Confirmations" })
  expect(group.getAttribute("data-agent-confirm")).toBe("Confirms replacing something that already exists")
  const boxes = within(group).getAllByRole("checkbox")
  expect(boxes.map((box) => box.getAttribute("aria-checked"))).toEqual(["false", "false"])
  for (const box of boxes) {
    expect(box.closest("[data-agent-confirm]")).toBe(group)
    expect(document.getElementById(box.getAttribute("aria-describedby") ?? "")?.textContent).toBe("OpenAI key")
  }
  expect(within(group).getByRole("checkbox", { name: "Replace the existing key" })).toBe(boxes[0])
  expect(within(group).getByRole("checkbox", { name: "Revoke the old key" })).toBe(boxes[1])
})

test("Approve waits for every confirmation, and the reason names the ones still missing", async () => {
  const user = userEvent.setup()
  const unconfirmed = vi.fn((labels: string[]) => `Confirm ${labels.join(", ")}.`)
  render(<Approval text={{ ...text, unconfirmed }} />)
  await user.click(checkbox("OpenAI key"))
  expect(unconfirmed).toHaveBeenLastCalledWith(
    ["OpenAI key"],
    [{ id: "openai", label: "OpenAI key", unticked: [0, 1] }],
  )
  await user.click(checkbox("Replace the existing key"))
  expect(approveButton().getAttribute("aria-disabled")).toBe("true")
  expect(unconfirmed).toHaveBeenLastCalledWith(["OpenAI key"], [{ id: "openai", label: "OpenAI key", unticked: [1] }])
  expect(blockedReason()?.textContent).toBe("Confirm OpenAI key.")
  await user.click(checkbox("Revoke the old key"))
  expect(approveButton().hasAttribute("aria-disabled")).toBe(false)
  expect(blockedReason()).toBeNull()
})

test("confirmed lists an item only once all its confirmations are ticked", async () => {
  const user = userEvent.setup()
  render(
    <Approval actions={(state) => <output data-testid="confirmed">{state.confirmed.join(",") || "none"}</output>} />,
  )
  await user.click(checkbox("OpenAI key"))
  await user.click(checkbox("Revoke the old key"))
  expect(screen.getByTestId("confirmed").textContent).toBe("none")
  await user.click(checkbox("Replace the existing key"))
  expect(screen.getByTestId("confirmed").textContent).toBe("openai")
})

test("onApprove gets the item as confirmed once both are ticked", async () => {
  const user = userEvent.setup()
  const onApprove = vi.fn()
  render(<Approval onApprove={onApprove} />)
  await user.click(checkbox("OpenAI key"))
  await user.click(checkbox("GitHub token"))
  await user.click(checkbox("Replace the existing key"))
  await user.click(checkbox("Revoke the old key"))
  await user.click(approveButton())
  expect(onApprove).toHaveBeenCalledWith({ selected: ["openai", "github"], confirmed: ["openai"] })
})

test("deselecting the item clears every one of its confirmations", async () => {
  const user = userEvent.setup()
  render(<Approval />)
  await user.click(checkbox("OpenAI key"))
  await user.click(checkbox("Replace the existing key"))
  await user.click(checkbox("Revoke the old key"))
  await user.click(checkbox("OpenAI key"))
  await user.click(checkbox("OpenAI key"))
  expect(checkbox("Replace the existing key").getAttribute("aria-checked")).toBe("false")
  expect(checkbox("Revoke the old key").getAttribute("aria-checked")).toBe("false")
  expect(approveButton().getAttribute("aria-disabled")).toBe("true")
})

test("without text, an agent's approve hears which confirmations are missing", async () => {
  approve = true
  render(<Approval defaultSelected={["openai"]} />)
  await act(async () => {})
  const both = await agent.act({ steps: [{ ref: "Approve", action: "approve" }] })
  expect(both.error?.message).toContain(
    `approve isn't available: OpenAI key needs 2 more confirmations ticked: "Replace the existing key", "Revoke the old key"`,
  )
  await agent.act({ steps: [{ ref: markersRef(), action: "confirmMarker", args: ["openai", true, 0] }] })
  const one = await agent.act({ steps: [{ ref: "Approve", action: "approve" }] })
  expect(one.error?.message).toContain(
    `approve isn't available: OpenAI key needs 1 more confirmation ticked: "Revoke the old key"`,
  )
})

test("an agent names the second confirmation by index or text, and each tick waits for a person", async () => {
  const onApprove = vi.fn()
  render(<Approval defaultSelected={["openai"]} onApprove={onApprove} />)
  await act(async () => {})
  expect(markers()).toMatchObject({
    missing: ["OpenAI key: Replace the existing key", "OpenAI key: Revoke the old key"],
    confirmed: [],
  })
  approve = true
  const unnamed = await agent.act({ steps: [{ ref: markersRef(), action: "confirmMarker", args: ["openai"] }] })
  expect(unnamed.error?.message).toContain("confirmMarker needs which confirmation of OpenAI key: it has 2")
  approve = false
  const second = { steps: [{ ref: markersRef(), action: "confirmMarker", args: ["OpenAI key", true, 1] }] }
  const refused = await agent.act(second)
  expect(refused.ok).toBe(false)
  expect(checkbox("Revoke the old key").getAttribute("aria-checked")).toBe("false")
  approve = true
  const approved = await agent.act(second)
  expect(approved.ok, approved.error?.message).toBe(true)
  expect(checkbox("Revoke the old key").getAttribute("aria-checked")).toBe("true")
  expect(markers()?.confirmed).toEqual([])
  const byText = await agent.act({
    steps: [{ ref: markersRef(), action: "confirmMarker", args: ["openai", true, "replace the EXISTING key"] }],
  })
  expect(byText.ok, byText.error?.message).toBe(true)
  expect(markers()).toMatchObject({ missing: [], confirmed: ["OpenAI key"] })
  const done = await agent.act({ steps: [{ ref: "Approve", action: "approve" }] })
  expect(done.ok, done.error?.message).toBe(true)
  expect(onApprove).toHaveBeenCalledWith({ selected: ["openai"], confirmed: ["openai"] })
})

test("an item with one confirmation in a list still takes confirmMarker with no index", async () => {
  approve = true
  render(
    <Approval
      items={[
        { id: "openai", label: "OpenAI key", marker: { label: "Replace", confirm: ["Replace the existing key"] } },
      ]}
      defaultSelected={["openai"]}
    />,
  )
  await act(async () => {})
  const result = await agent.act({ steps: [{ ref: markersRef(), action: "confirmMarker", args: ["openai"] }] })
  expect(result.ok, result.error?.message).toBe(true)
  expect(checkbox("Replace the existing key").getAttribute("aria-checked")).toBe("true")
})

test("two confirmations have no axe violations", async () => {
  const { container } = render(
    <main>
      <Approval defaultSelected={["openai"]} />
    </main>,
  )
  await act(async () => {})
  expect(await axeViolations(container)).toEqual([])
})
