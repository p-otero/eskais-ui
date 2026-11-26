import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { checkServer } from "@ui-sdk/core/testing"
import { createAgent } from "@ui-sdk/react/agent"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { Button } from "@/components/ui/button"
import {
  DeviceCodePrompt,
  type DeviceCodePromptProps,
  type DeviceCodePromptText,
} from "@/components/ui/device-code-prompt"
import { deviceCodePrompt } from "@/components/ui/device-code-prompt-primitive"
import { readAnnouncements } from "@/lib/test-utils"

import { axeViolations } from "./axe"

const agent = createAgent()

const uri = "https://provider.example/device"
const completeUri = "https://provider.example/device?user_code=WDJBMJHT"

const text: DeviceCodePromptText = {
  instructions: (link) => <>Go to {link} and enter this code.</>,
  open: "Open sign-in page",
  expiresIn: (_ms, time) => `Code expires in ${time}`,
  expired: "This code has expired.",
}

function Prompt(props: Partial<DeviceCodePromptProps>) {
  return <DeviceCodePrompt code="wdjbmjht" verificationUri={uri} text={text} {...props} />
}

const writeText = vi.fn(() => Promise.resolve())
const open = vi.fn()

beforeEach(() => {
  writeText.mockClear()
  open.mockClear()
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true })
  vi.stubGlobal("open", open)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

test("primitive: renders on the server as a group", () => {
  checkServer(deviceCodePrompt, {}, `<root aria-label="Sign-in code"></root>`)
})

test("shows the instructions around an external link that opens in a new tab, and the code grouped by PairingCode", () => {
  render(<Prompt />)
  const root = screen.getByRole("group", { name: "Sign-in code" })
  expect(root.textContent).toContain("Go to provider.example/device")
  const link = screen.getByRole("link", { name: /provider\.example\/device/ })
  expect(link.getAttribute("href")).toBe(uri)
  expect(link.getAttribute("target")).toBe("_blank")
  expect(link.getAttribute("rel")).toBe("noopener noreferrer")
  expect(link.textContent).toContain("(opens in a new tab)")
  const code = screen.getByRole("group", { name: "Code" })
  expect(code.getAttribute("data-slot")).toBe("pairing-code")
  expect(code.textContent).toContain("WDJB")
  expect(code.textContent).toContain("W D J B, M J H T")
})

test("groupSize and separator shape the code and what Copy writes", async () => {
  render(<Prompt code="abcdefghi" groupSize={3} separator=" " />)
  fireEvent.click(screen.getByRole("button", { name: "Copy code" }))
  await waitFor(() => expect(writeText).toHaveBeenCalledWith("ABC DEF GHI"))
})

test("Open opens the address with the code filled in when there is one, without an opener", () => {
  const onOpen = vi.fn()
  const { rerender } = render(<Prompt onOpen={onOpen} />)
  fireEvent.click(screen.getByRole("button", { name: "Open sign-in page" }))
  expect(open).toHaveBeenLastCalledWith(uri, "_blank", "noopener,noreferrer")
  rerender(<Prompt onOpen={onOpen} verificationUriComplete={completeUri} />)
  fireEvent.click(screen.getByRole("button", { name: "Open sign-in page" }))
  expect(open).toHaveBeenLastCalledWith(completeUri, "_blank", "noopener,noreferrer")
  expect(onOpen).toHaveBeenLastCalledWith(completeUri)
})

test("copyLink adds a button that copies the verification page and announces it", async () => {
  const onCopyLink = vi.fn()
  render(<Prompt copyLink onCopyLink={onCopyLink} />)
  fireEvent.click(screen.getByRole("button", { name: "Copy link" }))
  await screen.findByRole("button", { name: "Copied" })
  expect(writeText).toHaveBeenCalledWith(uri)
  expect(onCopyLink).toHaveBeenCalledWith(uri)
  await waitFor(() => expect(readAnnouncements().polite).toBe("Link copied"))
})

test("actions renders after Open", () => {
  render(<Prompt actions={<Button variant="outline">Cancel</Button>} />)
  const row = document.querySelector("[data-slot=device-code-prompt-actions]")
  expect(row?.textContent).toBe("Open sign-in pageCancel")
})

test("agents never read the code or the link by default, and open and copy fail with why", async () => {
  render(<Prompt copyLink verificationUriComplete={completeUri} />)
  const snapshot = agent.snapshot().filter((entry) => !entry.offPage)
  const everything = JSON.stringify([
    snapshot,
    await agent.query({ text: "WDJB" }),
    await agent.query({ text: "provider.example" }),
  ])
  expect(everything).not.toContain("WDJB")
  expect(everything).not.toContain("W D J B")
  expect(everything).not.toContain("provider.example")
  const entry = snapshot.find((candidate) => candidate.label === "Sign-in code")
  expect(entry).toMatchObject({ component: "device-code-prompt", actions: ["open", "copyLink"], expired: false })
  expect(snapshot.some((candidate) => candidate.label === "Open sign-in page")).toBe(false)
  const opened = await agent.act({ steps: [{ ref: "Sign-in code", action: "open" }] })
  expect(opened.error?.message).toContain("open isn't available: the code and its link are hidden from agents")
  const copied = await agent.act({ steps: [{ ref: "Sign-in code", action: "copyLink" }] })
  expect(copied.error?.message).toContain("copyLink isn't available: the code and its link are hidden from agents")
  const code = await agent.act({ steps: [{ ref: "Code", action: "copy" }] })
  expect(code.ok).toBe(false)
  expect(open).not.toHaveBeenCalled()
  expect(writeText).not.toHaveBeenCalled()
})

test("agentHidden={false} lets agents read the link, open it and copy it", async () => {
  render(<Prompt agentHidden={false} />)
  const entry = agent.snapshot().find((candidate) => !candidate.offPage && candidate.label === "Sign-in code")
  expect(entry).toMatchObject({ verificationUri: uri })
  const opened = await agent.act({ steps: [{ ref: "Sign-in code", action: "open" }] })
  expect(opened.ok, opened.error?.message).toBe(true)
  expect(open).toHaveBeenCalledWith(uri, "_blank", "noopener,noreferrer")
  const copied = await agent.act({ steps: [{ ref: "Sign-in code", action: "copyLink" }] })
  expect(copied.ok, copied.error?.message).toBe(true)
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(uri))
})

test("the countdown ticks, announces once a minute then every ten seconds, and expires once", async () => {
  vi.useFakeTimers({ now: new Date("2026-11-26T10:00:00Z") })
  const onExpire = vi.fn()
  const heard: string[] = []
  const observer = new MutationObserver(() => {
    const said = readAnnouncements().polite
    if (said && said !== heard.at(-1)) heard.push(said)
  })
  observer.observe(document.body, { subtree: true, childList: true, characterData: true })
  render(<Prompt expiresAt={Date.now() + 65_000} onExpire={onExpire} agentHidden={false} />)
  const timer = screen.getByRole("timer")
  expect(timer.textContent).toBe("Code expires in 1:05")
  await advance(5000)
  expect(timer.textContent).toBe("Code expires in 1:00")
  await advance(40_000)
  expect(timer.textContent).toBe("Code expires in 0:20")
  expect(onExpire).not.toHaveBeenCalled()
  await advance(20_000)
  expect(onExpire).toHaveBeenCalledTimes(1)
  await advance(200)
  observer.disconnect()
  expect(heard).toEqual([
    "Code expires in 1:00",
    "Code expires in 0:30",
    "Code expires in 0:20",
    "Code expires in 0:10",
    "This code has expired.",
  ])
  expect(screen.queryByRole("timer")).toBeNull()
  expect(screen.queryByRole("link")).toBeNull()
  expect(screen.queryByRole("button", { name: "Open sign-in page" })).toBeNull()
  expect(document.querySelector("[data-slot=device-code-prompt-expired]")?.textContent).toBe("This code has expired.")
  await advance(60_000)
  expect(onExpire).toHaveBeenCalledTimes(1)
  vi.useRealTimers()
  const result = await agent.act({ steps: [{ ref: "Sign-in code", action: "open" }] })
  expect(result.error?.message).toContain("open isn't available: the code has expired")
  expect(open).not.toHaveBeenCalled()
})

test("a code that has already expired calls onExpire once on mount, and a Date works as expiresAt", () => {
  const onExpire = vi.fn()
  render(<Prompt expiresAt={new Date(Date.now() - 1000)} onExpire={onExpire} />)
  expect(onExpire).toHaveBeenCalledTimes(1)
  expect(screen.getByRole("group", { name: "Sign-in code" }).hasAttribute("data-expired")).toBe(true)
})

test("actions stay once the code expires, for a new code or a cancel", () => {
  render(<Prompt expiresAt={Date.now() - 1000} actions={<Button variant="outline">New code</Button>} />)
  expect(screen.getByRole("button", { name: "New code" })).toBeTruthy()
  expect(screen.queryByRole("button", { name: "Open sign-in page" })).toBeNull()
})

test("every control is named, and there are no axe violations", async () => {
  const { container } = render(
    <main>
      <Prompt copyLink expiresAt={Date.now() + 600_000} agentHidden={false} />
    </main>,
  )
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  expect(await axeViolations(container)).toEqual([])
})
