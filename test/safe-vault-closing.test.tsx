import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { useState } from "react"
import { afterEach, expect, test, vi } from "vitest"

import { Button } from "@/components/ui/button"
import { SafeVault, type SafeVaultStatus } from "@/components/ui/safe-vault"
import { lockMs } from "@/components/ui/safe-vault-timeline"

const stage = vi.hoisted(() => ({ onRenderer: (_webgl: boolean) => {} }))

vi.mock("@/components/ui/use-safe-vault-stage", () => ({
  useSafeVaultStage: (_host: unknown, _layer: unknown, input: { onRenderer: (webgl: boolean) => void }) => {
    stage.onRenderer = input.onRenderer
  },
}))

async function renderWithTheSafeShown() {
  render(<App />)
  await act(async () => {
    stage.onRenderer(true)
  })
}

const agent = createAgent()
let reduced = false

window.matchMedia = ((media: string) => ({
  matches: media.includes("reduce") && reduced,
  media,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
})) as unknown as typeof window.matchMedia

afterEach(() => {
  reduced = false
  vi.useRealTimers()
})

function App() {
  const [status, setStatus] = useState<SafeVaultStatus>("unlocked")
  return (
    <SafeVault label="Vault" status={status} onStatusChange={setStatus}>
      <p>esk_demo_key</p>
      <Button>Copy</Button>
    </SafeVault>
  )
}

const contents = () => document.querySelector<HTMLElement>('[data-slot="safe-vault-contents"]')
const shownToAgents = () =>
  agent
    .snapshot()
    .filter((entry) => !entry.offPage)
    .map((entry) => entry.label)

async function lock() {
  const user = userEvent.setup({ delay: null })
  await user.click(screen.getByRole("button", { name: "Lock" }))
  await act(async () => {})
}

test("locked, the contents stay on the plaque while the door shuts, out of reach, then leave the page", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"], shouldAdvanceTime: true })
  await renderWithTheSafeShown()
  expect(shownToAgents()).toContain("Copy")
  expect(contents()?.hasAttribute("inert")).toBe(false)

  await lock()
  const region = contents()
  expect(region?.textContent).toContain("esk_demo_key")
  expect(region?.hidden).toBe(false)
  expect(region?.hasAttribute("inert")).toBe(true)
  expect(region?.getAttribute("aria-hidden")).toBe("true")
  expect(region?.hasAttribute("data-agent-hidden")).toBe(true)
  expect(screen.queryByRole("region", { name: "Vault contents" })).toBeNull()
  expect(shownToAgents()).not.toContain("Copy")
  expect(document.querySelector('[data-slot="safe-vault"]')?.hasAttribute("data-closing")).toBe(true)

  await act(async () => {
    vi.advanceTimersByTime(lockMs - 200)
  })
  expect(contents()?.textContent).toContain("esk_demo_key")
  await act(async () => {
    vi.advanceTimersByTime(400)
  })
  expect(screen.queryByText("esk_demo_key")).toBeNull()
  expect(contents()?.hidden).toBe(true)
  expect(document.querySelector('[data-slot="safe-vault"]')?.hasAttribute("data-closing")).toBe(false)
})

test("under reduced motion the contents leave the page as soon as it locks", async () => {
  reduced = true
  await renderWithTheSafeShown()
  await lock()
  expect(screen.queryByText("esk_demo_key")).toBeNull()
  expect(contents()?.hidden).toBe(true)
})
