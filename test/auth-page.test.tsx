import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { createAgent } from "@ui-sdk/react/agent"
import { renderToString } from "react-dom/server"
import { afterEach, expect, test, vi } from "vitest"

import { AuthPage, type AuthPageProps } from "@/components/ui/auth-page"

import { axeViolations } from "./axe"

const agent = createAgent()

afterEach(cleanup)

function SignIn(props: Partial<AuthPageProps>) {
  return (
    <AuthPage
      logo={<span>Acme</span>}
      title="Sign in"
      description="Use the passkey on this device."
      action={{ label: "Sign in with a passkey", onAction: () => undefined }}
      workingLabel="Waiting for your passkey"
      error="The passkey wasn't accepted."
      retry={{ label: "Try again" }}
      success={<p>Signed in</p>}
      secondary={<a href="#/recover">Use a recovery code</a>}
      footer={<a href="#/privacy">Privacy</a>}
      {...props}
    />
  )
}

const action = () => screen.getByRole("button", { name: "Sign in with a passkey" })

test("renders on the server: a main landmark with the title as its heading", () => {
  const html = renderToString(<SignIn />)
  expect(html).toContain("<main")
  expect(html).toContain("<h1")
  expect(html).toContain('data-status="idle"')
})

test("idle: the logo, title, description, action, other options and footer", () => {
  render(<SignIn />)
  const main = screen.getByRole("main")
  expect(within(main).getByRole("heading", { level: 1, name: "Sign in" })).toBeTruthy()
  expect(within(main).getByText("Acme")).toBeTruthy()
  expect(within(main).getByRole("link", { name: "Use a recovery code" })).toBeTruthy()
  expect(screen.getByRole("contentinfo").textContent).toContain("Privacy")
  expect(action().getAttribute("aria-busy")).toBeNull()
  expect(screen.queryByRole("alert")).toBeNull()
})

test("working: the action is pending and keeps focus, the card is busy, and the working label is read politely", () => {
  const onAction = vi.fn()
  render(<SignIn status="working" action={{ label: "Sign in with a passkey", onAction }} />)
  expect(action().getAttribute("aria-busy")).toBe("true")
  expect(action().hasAttribute("data-pending")).toBe(true)
  fireEvent.click(action())
  expect(onAction).not.toHaveBeenCalled()
  expect(screen.getByRole("main").getAttribute("aria-busy")).toBe("true")
  const status = screen.getAllByRole("status").find((region) => region.dataset.slot === "auth-page-announcer")
  expect(status?.textContent).toBe("Waiting for your passkey")
})

test("the working label is empty outside working, so it's read once each time", () => {
  const { rerender } = render(<SignIn />)
  const announcer = document.querySelector('[data-slot="auth-page-announcer"]')
  expect(announcer?.textContent).toBe("")
  rerender(<SignIn status="working" />)
  expect(announcer?.textContent).toBe("Waiting for your passkey")
  rerender(<SignIn status="error" />)
  expect(announcer?.textContent).toBe("")
})

test("error: a live destructive alert with a retry that runs the action again by default", () => {
  const onAction = vi.fn()
  render(<SignIn status="error" action={{ label: "Sign in with a passkey", onAction }} />)
  const alert = screen.getByRole("alert")
  expect(alert.getAttribute("data-tone")).toBe("destructive")
  expect(alert.textContent).toContain("The passkey wasn't accepted.")
  fireEvent.click(within(alert).getByRole("button", { name: "Try again" }))
  expect(onAction).toHaveBeenCalledTimes(1)
})

test("error: retry runs its own onRetry when given", () => {
  const onRetry = vi.fn()
  const onAction = vi.fn()
  render(
    <SignIn
      status="error"
      action={{ label: "Sign in with a passkey", onAction }}
      retry={{ label: "Try again", onRetry }}
    />,
  )
  fireEvent.click(screen.getByRole("button", { name: "Try again" }))
  expect(onRetry).toHaveBeenCalledTimes(1)
  expect(onAction).not.toHaveBeenCalled()
})

test("success: the success slot replaces the action and the other options", () => {
  render(<SignIn status="success" />)
  expect(screen.getByText("Signed in")).toBeTruthy()
  expect(screen.queryByRole("button", { name: "Sign in with a passkey" })).toBeNull()
  expect(screen.queryByRole("link", { name: "Use a recovery code" })).toBeNull()
})

test("an alert slot shows in any status, beside the fields given as children", () => {
  render(
    <SignIn alert={<p>Invited by Ana Ruiz</p>}>
      <p>Fields go here</p>
    </SignIn>,
  )
  expect(screen.getByText("Invited by Ana Ruiz")).toBeTruthy()
  expect(screen.getByText("Fields go here")).toBeTruthy()
})

test("agents press the primary action and the retry by name", async () => {
  const onAction = vi.fn()
  const { rerender } = render(<SignIn action={{ label: "Sign in with a passkey", onAction }} />)
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  const first = await agent.act({ steps: [{ ref: "Sign in with a passkey", action: "press" }] })
  expect(first.ok, first.error?.message).toBe(true)
  expect(onAction).toHaveBeenCalledTimes(1)
  rerender(<SignIn status="error" action={{ label: "Sign in with a passkey", onAction }} />)
  const retry = await agent.act({ steps: [{ ref: "Try again", action: "press" }] })
  expect(retry.ok, retry.error?.message).toBe(true)
  expect(onAction).toHaveBeenCalledTimes(2)
})

test("has no axe violations in every status", async () => {
  for (const status of ["idle", "working", "error", "success"] as const) {
    const { container, unmount } = render(<SignIn status={status} />)
    expect(await axeViolations(container), status).toEqual([])
    unmount()
  }
})
