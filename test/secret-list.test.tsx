import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { checkServer } from "@ui-sdk/core/testing"
import { createAgent } from "@ui-sdk/react/agent"
import type { ReactNode } from "react"
import { afterEach, beforeEach, expect, expectTypeOf, test, vi } from "vitest"

import { SecretList, type SecretListProps, type SecretListText, type StoredSecret } from "@/components/ui/secret-list"
import { secretList } from "@/components/ui/secret-list-primitive"

import { axeViolations } from "./axe"

const DAY = 86_400_000

let approve = false
const agent = createAgent({ allow: (step) => !step.confirm || approve })

beforeEach(() => {
  approve = false
})
afterEach(cleanup)

const text: SecretListText = {
  configured: "Configured",
  missing: "Missing",
  replace: "Replace",
  set: "Set",
  delete: "Delete",
  deleteTitle: "Delete this secret?",
  deleteConfirm: "Delete secret",
  deleteAgentConfirm: "Deletes the secret; anything using it stops working",
  created: (time: ReactNode) => <>Created {time}</>,
  updated: (time: ReactNode) => <>Updated {time}</>,
  lastUsed: (time: ReactNode) => <>Last used {time}</>,
  neverUsed: "Never used",
  emptyTitle: "No secrets yet",
  errorTitle: "Secrets couldn't load",
  retry: "Try again",
}

const secrets: StoredSecret[] = [
  {
    id: "openai",
    name: "OpenAI key",
    configured: true,
    fingerprint: "a1b2",
    updatedAt: Date.now() - 2 * DAY,
    lastUsedAt: Date.now() - 3_600_000,
  },
  { id: "stripe", name: "Stripe webhook secret", configured: true, lastUsedAt: null },
  { id: "github", name: "GitHub token", configured: false },
]

function Secrets(props: Partial<SecretListProps> & { text?: SecretListText }) {
  return (
    <SecretList
      aria-label="API keys"
      secrets={secrets}
      onReplace={() => undefined}
      onDelete={() => undefined}
      text={text}
      locale="en"
      {...props}
    />
  )
}

const row = (name: string) => {
  const item = screen.getByText(name).closest('[data-slot="list-item"]')
  if (!(item instanceof HTMLElement)) throw new Error(`No row for ${name}`)
  return item
}

test("primitive: renders on the server as a named group", () => {
  checkServer(secretList, {}, `<root aria-label="API keys"></root>`)
})

test("a row shows the name, a mask with the fingerprint, its status and its dates", () => {
  render(<Secrets />)
  const openai = row("OpenAI key")
  expect(openai.querySelector('[data-slot="secret-fingerprint"]')?.textContent).toBe(
    "•••• a1b2Hidden value ending in a1b2",
  )
  expect(within(openai).getByText("Configured").closest('[data-slot="status-pill"]')?.getAttribute("data-tone")).toBe(
    "success",
  )
  expect(openai.textContent).toContain("Updated 2 days ago")
  expect(openai.textContent).toContain("Last used 1 hr. ago")
  expect(row("Stripe webhook secret").textContent).toContain("Never used")
  expect(row("Stripe webhook secret").textContent).toContain("Hidden value")
})

test("a missing secret has a warning status, no mask, and Set in place of Replace", () => {
  render(<Secrets />)
  const github = row("GitHub token")
  expect(within(github).getByText("Missing").closest('[data-slot="status-pill"]')?.getAttribute("data-tone")).toBe(
    "warning",
  )
  expect(github.querySelector('[data-slot="secret-fingerprint"]')).toBeNull()
  expect(within(github).getByRole("button", { name: "Set GitHub token" }).textContent).toBe("Set")
  expect(within(github).queryByRole("button", { name: /Delete/ })).toBeNull()
})

test("an agent can't delete a missing secret: the step fails with why and nothing opens", async () => {
  render(<Secrets />)
  const result = await agent.act({ steps: [{ ref: "API keys", action: "delete", args: ["github"] }] })
  expect(result.ok).toBe(false)
  expect(result.error?.message).toContain(`delete isn't available: "github" has no stored value.`)
  expect(screen.queryByRole("alertdialog")).toBeNull()
})

test("the confirmation's text can name the secret it deletes, and plain strings still work", async () => {
  const { unmount } = render(
    <Secrets
      text={{
        ...text,
        deleteTitle: (secret) => `Delete ${secret.name}?`,
        deleteDescription: (secret) => `${secret.name} stops working at once.`,
        deleteAgentConfirm: (secret) => `Deletes ${secret.name}`,
      }}
    />,
  )
  fireEvent.click(screen.getByRole("button", { name: "Delete OpenAI key" }))
  const dialog = await screen.findByRole("alertdialog", { name: "Delete OpenAI key?" })
  expect(dialog.textContent).toContain("OpenAI key stops working at once.")
  expect(dialog.querySelector("[data-agent-confirm]")?.getAttribute("data-agent-confirm")).toBe("Deletes OpenAI key")
  unmount()
  render(<Secrets />)
  fireEvent.click(screen.getByRole("button", { name: "Delete Stripe webhook secret" }))
  expect(await screen.findByRole("alertdialog", { name: "Delete this secret?" })).toBeTruthy()
})

test("the stored secret's type has no value field, only a fingerprint", () => {
  expectTypeOf<StoredSecret>().not.toHaveProperty("value")
  expectTypeOf<StoredSecret>().toHaveProperty("fingerprint").toEqualTypeOf<string | undefined>()
  const secret: StoredSecret = {
    id: "x",
    name: "X",
    configured: true,
    // @ts-expect-error -- a stored secret never carries its value
    value: "sk-live",
  }
  expect(secret.id).toBe("x")
})

test("Replace runs onReplace with the row's id", () => {
  const onReplace = vi.fn()
  render(<Secrets onReplace={onReplace} />)
  fireEvent.click(screen.getByRole("button", { name: "Replace OpenAI key" }))
  expect(onReplace).toHaveBeenCalledWith("openai")
})

test("Delete asks first; the confirm button carries data-agent-confirm and Cancel keeps the secret", async () => {
  const onDelete = vi.fn()
  render(<Secrets onDelete={onDelete} />)
  fireEvent.click(screen.getByRole("button", { name: "Delete OpenAI key" }))
  const dialog = await screen.findByRole("alertdialog", { name: "Delete this secret?" })
  expect(dialog.querySelector("[data-agent-confirm]")?.getAttribute("data-agent-confirm")).toBe(
    "Deletes the secret; anything using it stops working",
  )
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }))
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
  expect(onDelete).not.toHaveBeenCalled()
})

test("loading, empty and error come through DataState", () => {
  const onRetry = vi.fn()
  const { rerender } = render(<Secrets status="pending" secrets={[]} />)
  expect(screen.getByText("Loading")).toBeTruthy()
  rerender(<Secrets secrets={[]} />)
  expect(screen.getByText("No secrets yet")).toBeTruthy()
  rerender(<Secrets status="error" error={new Error("offline")} onRetry={onRetry} secrets={[]} />)
  expect(screen.getByText("Secrets couldn't load")).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Try again" }))
  expect(onRetry).toHaveBeenCalled()
})

test("agents see every control named, and the secrets as the list's items", () => {
  render(<Secrets />)
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  const list = components.find((entry) => entry.component === "secret-list")
  expect(list?.label).toBe("API keys")
  expect(list?.actions).toEqual(["replace", "delete", "select", "selectAll"])
  expect(list?.items).toEqual([
    { value: "openai", label: "OpenAI key" },
    { value: "stripe", label: "Stripe webhook secret" },
    { value: "github", label: "GitHub token" },
  ])
})

test("an agent replaces by id", async () => {
  const onReplace = vi.fn()
  render(<Secrets onReplace={onReplace} />)
  const result = await agent.act({ steps: [{ ref: "API keys", action: "replace", args: ["stripe"] }] })
  expect(result.ok, result.error?.message).toBe(true)
  expect(onReplace).toHaveBeenCalledWith("stripe")
})

test("an unknown id fails replace and delete with why, and nothing runs", async () => {
  const onReplace = vi.fn()
  render(<Secrets onReplace={onReplace} />)
  for (const action of ["replace", "delete"]) {
    const result = await agent.act({ steps: [{ ref: "API keys", action, args: ["aws"] }] })
    expect(result.ok).toBe(false)
    expect(result.error?.message).toContain(`${action} has no secret with the id "aws".`)
  }
  expect(onReplace).not.toHaveBeenCalled()
  expect(screen.queryByRole("alertdialog")).toBeNull()
})

test("an agent's delete opens the confirmation, whose confirm needs a person: refused, then approved", async () => {
  const onDelete = vi.fn(() => Promise.resolve())
  render(<Secrets onDelete={onDelete} />)
  const ask = await agent.act({ steps: [{ ref: "API keys", action: "delete", args: ["openai"] }] })
  expect(ask.ok, ask.error?.message).toBe(true)
  await screen.findByRole("alertdialog", { name: "Delete this secret?" })
  const confirm = { steps: [{ ref: "Delete this secret?", action: "press", args: ["Delete secret"] }] }
  expect((await agent.act(confirm)).ok).toBe(false)
  expect(onDelete).not.toHaveBeenCalled()
  await agent.act({ steps: [{ ref: "API keys", action: "delete", args: ["openai"] }] })
  await screen.findByRole("alertdialog")
  approve = true
  const done = await agent.act(confirm)
  expect(done.ok, done.error?.message).toBe(true)
  expect(onDelete).toHaveBeenCalledWith("openai")
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
})

test("has no axe violations", async () => {
  const { container } = render(
    <main>
      <Secrets />
    </main>,
  )
  expect(await axeViolations(container)).toEqual([])
})
