import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { Button } from "@/components/ui/button"
import { DescriptionDetails, DescriptionItem, DescriptionTerm } from "@/components/ui/description-list"
import {
  SettingsDangerAction,
  SettingsDangerZone,
  SettingsFacts,
  SettingsPage,
  SettingsRow,
  SettingsSection,
  type SettingsPageProps,
} from "@/components/ui/settings-page"
import { Switch } from "@/components/ui/switch"
import { createUrlParam } from "@/lib/url-param"
import { hashRouter } from "@/lib/url-router"

import { axeViolations } from "./axe"
import { settle } from "./overlay-helpers"

type Observed = { callback: IntersectionObserverCallback; elements: Element[] }
let observers: Observed[] = []
const scrolled: string[] = []

beforeEach(() => {
  observers = []
  scrolled.length = 0
  history.replaceState(null, "", "/")
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      entry: Observed
      constructor(callback: IntersectionObserverCallback) {
        this.entry = { callback, elements: [] }
        observers.push(this.entry)
      }
      observe(element: Element) {
        this.entry.elements.push(element)
      }
      disconnect() {}
    },
  )
  vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(function (this: Element) {
    scrolled.push(this.id)
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function intersect(ids: readonly string[]) {
  const observer = observers.at(-1)!
  const entries = observer.elements.map((target) => ({ target, isIntersecting: ids.includes(target.id) }))
  act(() => observer.callback(entries as unknown as IntersectionObserverEntry[], {} as IntersectionObserver))
}

let approve = false
const onDelete = vi.fn()

function Settings(props: Partial<SettingsPageProps>) {
  return (
    <SettingsPage {...props}>
      <SettingsSection id="account" title="Account" description="How you appear">
        <SettingsRow label="Email updates" description="A weekly summary">
          <Switch />
        </SettingsRow>
      </SettingsSection>
      <SettingsSection id="security" title="Security" actions={<Button size="sm">Download codes</Button>}>
        <SettingsRow field={false} label="Other sessions">
          <Button>Sign out other sessions</Button>
        </SettingsRow>
        <SettingsFacts aria-label="This device">
          <DescriptionItem>
            <DescriptionTerm>Browser</DescriptionTerm>
            <DescriptionDetails>Safari 18</DescriptionDetails>
          </DescriptionItem>
        </SettingsFacts>
      </SettingsSection>
      <SettingsDangerZone id="danger" title="Danger zone">
        <SettingsDangerAction
          label="Delete account"
          trigger="Delete account"
          title="Delete your account?"
          confirmLabel="Delete forever"
          agentConfirm="Deletes the account"
          onConfirm={onDelete}
        />
      </SettingsDangerZone>
    </SettingsPage>
  )
}

test("SettingsPage: the nav lists the sections, marks the one being read and jumps to one by id", async () => {
  const user = userEvent.setup()
  const onSectionChange = vi.fn()
  const { container } = render(<Settings onSectionChange={onSectionChange} />)
  const nav = screen.getByRole("navigation", { name: "Settings sections" })
  expect(
    within(nav)
      .getAllByRole("link")
      .map((link) => link.textContent),
  ).toEqual(["Account", "Security", "Danger zone"])
  expect(within(nav).getByRole("link", { name: "Account" }).getAttribute("aria-current")).toBe("location")

  intersect(["security"])
  expect(within(nav).getByRole("link", { name: "Security" }).getAttribute("aria-current")).toBe("location")
  expect(onSectionChange).toHaveBeenLastCalledWith("security", { reason: "scroll" })

  await user.click(within(nav).getByRole("link", { name: "Danger zone" }))
  expect(scrolled.at(-1)).toBe("danger")
  expect(location.hash).toBe("")
  expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Danger zone" }))
  expect(onSectionChange).toHaveBeenLastCalledWith("danger", { reason: "nav" })
  expect(await axeViolations(container)).toEqual([])
})

test("SettingsPage: rows name their control, and the danger zone is a destructive section", () => {
  render(<Settings />)
  const toggle = screen.getByRole("switch", { name: "Email updates" })
  expect(toggle.getAttribute("aria-describedby")).toBeTruthy()
  expect(screen.getByRole("region", { name: "Danger zone" }).dataset.tone).toBe("destructive")
  expect(screen.getByRole("region", { name: "Account" }).getAttribute("aria-describedby")).toBeTruthy()
  const facts = document.querySelector<HTMLElement>('[data-slot="settings-facts"]')!
  expect(facts.tagName).toBe("DL")
  expect(facts.dataset.layout).toBe("inline")
  expect(within(facts).getByText("Safari 18").closest("dd")).toBeTruthy()
})

test("SettingsPage: a deep link in a hash route scrolls to its section, and going to one records it", async () => {
  const user = userEvent.setup()
  history.replaceState(null, "", "/#/settings?section=security")
  const url = createUrlParam("section", { in: "hash", history: "replace" })
  render(<Settings url={url} />)
  expect(scrolled).toEqual(["security"])
  const nav = screen.getByRole("navigation", { name: "Settings sections" })
  expect(within(nav).getByRole("link", { name: "Security" }).getAttribute("aria-current")).toBe("location")

  await user.click(within(nav).getByRole("link", { name: "Account" }))
  expect(location.hash).toBe("#/settings?section=account")
  expect(scrolled).toEqual(["security", "account"])
})

test("SettingsPage: currentSection controls the mark", () => {
  render(<Settings currentSection="danger" />)
  intersect(["account"])
  const nav = screen.getByRole("navigation", { name: "Settings sections" })
  expect(within(nav).getByRole("link", { name: "Danger zone" }).getAttribute("aria-current")).toBe("location")
})

test("SettingsPage: agents go to sections and need a person to confirm a danger action", async () => {
  render(<Settings />)
  await settle()
  const agent = createAgent({ allow: (step) => !step.confirm || approve })
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  const labels = components.map((entry) => entry.label)
  expect(labels).toEqual(expect.arrayContaining(["Security", "Go to section", "Email updates", "Delete account"]))

  let result = await act(() => agent.act({ steps: [{ ref: "Security", action: "follow" }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(scrolled.at(-1)).toBe("security")

  result = await agent.act({ steps: [{ ref: "Go to section", action: "setValue", args: ["Danger zone"] }] })
  expect(result.ok, result.error?.message).toBe(true)
  expect(scrolled.at(-1)).toBe("danger")

  const remove = { steps: [{ ref: "Delete account", action: "press", args: ["Delete forever"] }] }
  result = await agent.act(remove)
  expect(result.ok).toBe(false)
  expect(onDelete).not.toHaveBeenCalled()
  approve = true
  result = await agent.act(remove)
  expect(result.ok, result.error?.message).toBe(true)
  expect(onDelete).toHaveBeenCalledOnce()
})

test("SettingsPage: with a router adapter, section links are the app's route and a click keeps it", async () => {
  const user = userEvent.setup()
  history.replaceState(null, "", "/#/settings")
  render(<Settings url={createUrlParam("section", { router: hashRouter() })} />)
  const nav = screen.getByRole("navigation", { name: "Settings sections" })
  const security = within(nav).getByRole("link", { name: "Security" })
  expect(security.getAttribute("href")).toBe("#/settings?section=security")
  await user.click(security)
  expect(location.hash).toBe("#/settings?section=security")
  expect(scrolled.at(-1)).toBe("security")
})

test("SettingsPage: without a url, links stay in-page anchors; getHref still wins", () => {
  const { unmount } = render(<Settings />)
  expect(screen.getByRole("link", { name: "Security" }).getAttribute("href")).toBe("#security")
  unmount()
  render(<Settings url={createUrlParam("section", { in: "hash" })} getHref={(id) => `#/prefs/${id}`} />)
  expect(screen.getByRole("link", { name: "Security" }).getAttribute("href")).toBe("#/prefs/security")
})

test('SettingsPage: navigation="buttons" scrolls by button, and agents press them by name', async () => {
  const user = userEvent.setup()
  const onSectionChange = vi.fn()
  render(<Settings navigation="buttons" onSectionChange={onSectionChange} />)
  const nav = screen.getByRole("navigation", { name: "Settings sections" })
  expect(within(nav).queryByRole("link")).toBeNull()
  await user.click(within(nav).getByRole("button", { name: "Security" }))
  expect(scrolled.at(-1)).toBe("security")
  expect(within(nav).getByRole("button", { name: "Security" }).getAttribute("aria-current")).toBe("location")
  expect(location.hash).toBe("")
  expect(onSectionChange).toHaveBeenLastCalledWith("security", { reason: "nav" })

  await settle()
  const agent = createAgent()
  const result = await act(() => agent.act({ steps: [{ ref: "Danger zone", action: "press" }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(scrolled.at(-1)).toBe("danger")
})

test("SettingsDangerAction: disabled and pending reach the trigger; agents still need approval once it's enabled", async () => {
  const onConfirm = vi.fn()
  const action = (state: { disabled?: boolean; pending?: boolean }) => (
    <SettingsDangerZone id="danger" title="Danger zone">
      <SettingsDangerAction
        data-testid="reset-row"
        label="Reset device"
        trigger="Reset device"
        title="Reset this device?"
        confirmLabel="Reset now"
        agentConfirm="Erases the device's settings"
        onConfirm={onConfirm}
        {...state}
      />
    </SettingsDangerZone>
  )
  const { rerender } = render(action({ disabled: true }))
  expect(screen.getByTestId("reset-row").dataset.slot).toBe("settings-row")
  expect(screen.getByRole("button", { name: "Reset device" }).hasAttribute("disabled")).toBe(true)
  rerender(action({ pending: true }))
  const trigger = screen.getByRole("button", { name: "Reset device" })
  expect(trigger.getAttribute("aria-busy")).toBe("true")
  expect(trigger.hasAttribute("data-pending")).toBe(true)

  rerender(action({}))
  await settle()
  let allowed = false
  const agent = createAgent({ allow: (step) => !step.confirm || allowed })
  const press = { steps: [{ ref: "Reset device", action: "press", args: ["Reset now"] }] }
  let result = await agent.act(press)
  expect(result.ok).toBe(false)
  expect(onConfirm).not.toHaveBeenCalled()
  allowed = true
  result = await agent.act(press)
  expect(result.ok, result.error?.message).toBe(true)
  expect(onConfirm).toHaveBeenCalledOnce()
})
