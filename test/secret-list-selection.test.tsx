import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { useState } from "react"
import { beforeEach, expect, test, vi } from "vitest"

import { SecretList, type SecretListProps, type SecretListText, type StoredSecret } from "@/components/ui/secret-list"

import { axeViolations } from "./axe"

let approve = false
const agent = createAgent({ allow: (step) => !step.confirm || approve })

beforeEach(() => {
  approve = false
})

const text: SecretListText = {
  configured: "Configured",
  missing: "Missing",
  replace: "Replace",
  delete: "Delete",
  deleteTitle: "Delete this secret?",
  deleteConfirm: "Delete secret",
  deleteAgentConfirm: "Deletes the secret",
  emptyTitle: "No secrets yet",
  errorTitle: "Secrets couldn't load",
  selectAll: "Select all",
}

const secrets: StoredSecret[] = [
  { id: "openai", name: "OpenAI key", configured: true, fingerprint: "a1b2" },
  { id: "stripe", name: "Stripe key", configured: true, disabled: { reason: "Already on your account" } },
  { id: "github", name: "GitHub token", configured: true, fingerprint: "9f3c" },
]

function Secrets(props: Partial<SecretListProps>) {
  return (
    <SecretList
      aria-label="Local keys"
      secrets={secrets}
      selectable
      onReplace={() => undefined}
      onDelete={() => undefined}
      text={text}
      {...props}
    />
  )
}

function RefusesGitHub() {
  const [selected, setSelected] = useState<string[]>([])
  return (
    <Secrets
      selected={selected}
      onSelectedChange={(ids, details) => {
        if (ids.includes("github")) details.cancel()
        else setSelected(ids)
      }}
    />
  )
}

function ControlledSecrets() {
  const [selected, setSelected] = useState<string[]>([])
  return <Secrets selected={selected} onSelectedChange={setSelected} />
}

const checkbox = (name: string) => screen.getByRole("checkbox", { name })
const isChecked = (name: string) => checkbox(name).getAttribute("aria-checked")
const listEntry = () => agent.snapshot().find((entry) => entry.component === "secret-list" && !entry.offPage)

test("each row gets a checkbox named by the secret; a disabled one shows its reason and is described by it", () => {
  render(<Secrets />)
  expect(isChecked("OpenAI key")).toBe("false")
  const stripe = checkbox("Stripe key")
  expect(stripe.getAttribute("aria-disabled")).toBe("true")
  const reason = document.getElementById(stripe.getAttribute("aria-describedby") ?? "")
  expect(reason?.textContent).toBe("Already on your account")
  expect(within(stripe.closest<HTMLElement>("[data-slot=list-item]")!).getByText("Already on your account")).toBe(
    reason,
  )
})

test("pressing a row's checkbox selects it and reports the ids; Replace and Delete still work beside it", async () => {
  const user = userEvent.setup()
  const onSelectedChange = vi.fn()
  const onReplace = vi.fn()
  render(<Secrets onSelectedChange={onSelectedChange} onReplace={onReplace} />)
  await user.click(checkbox("OpenAI key"))
  expect(onSelectedChange).toHaveBeenLastCalledWith(["openai"], expect.objectContaining({ reason: "press" }))
  expect(isChecked("OpenAI key")).toBe("true")
  await user.click(screen.getByRole("button", { name: "Replace OpenAI key" }))
  expect(onReplace).toHaveBeenCalledWith("openai")
  fireEvent.click(screen.getByRole("button", { name: "Delete OpenAI key" }))
  expect(await screen.findByRole("alertdialog", { name: "Delete this secret?" })).toBeTruthy()
  expect(isChecked("OpenAI key")).toBe("true")
})

test("Tab reaches each row's checkbox before its buttons, and Space toggles it", async () => {
  const user = userEvent.setup()
  render(<Secrets text={{ ...text, selectAll: undefined }} />)
  await user.tab()
  expect(document.activeElement).toBe(checkbox("OpenAI key"))
  await user.keyboard(" ")
  expect(isChecked("OpenAI key")).toBe("true")
  await user.tab()
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Replace OpenAI key" }))
})

test("select all is tri-state and skips disabled rows", async () => {
  const user = userEvent.setup()
  const onSelectedChange = vi.fn()
  render(<Secrets defaultSelected={["github"]} onSelectedChange={onSelectedChange} />)
  expect(isChecked("Select all")).toBe("mixed")
  await user.click(checkbox("Select all"))
  expect(onSelectedChange).toHaveBeenLastCalledWith(
    ["github", "openai"],
    expect.objectContaining({ reason: "select-all" }),
  )
  expect(isChecked("Select all")).toBe("true")
  expect(isChecked("Stripe key")).toBe("false")
  await user.click(checkbox("Select all"))
  expect(onSelectedChange).toHaveBeenLastCalledWith([], expect.anything())
  expect(isChecked("Select all")).toBe("false")
})

test("select all leaves a disabled row that's already selected as it is", async () => {
  const user = userEvent.setup()
  const onSelectedChange = vi.fn()
  render(<Secrets selected={["stripe", "openai", "github"]} onSelectedChange={onSelectedChange} />)
  expect(isChecked("Select all")).toBe("true")
  await user.click(checkbox("Select all"))
  expect(onSelectedChange).toHaveBeenLastCalledWith(["stripe"], expect.anything())
})

test("a controlled selection follows its prop, and a cancelled change keeps it", async () => {
  const user = userEvent.setup()
  render(<RefusesGitHub />)
  await user.click(checkbox("OpenAI key"))
  expect(isChecked("OpenAI key")).toBe("true")
  await user.click(checkbox("GitHub token"))
  expect(isChecked("GitHub token")).toBe("false")
})

test("agents select by name in any case or by id, and the snapshot lists the selected names", async () => {
  const onSelectedChange = vi.fn()
  render(<Secrets onSelectedChange={onSelectedChange} />)
  expect(listEntry()).toMatchObject({ actions: ["replace", "delete", "select", "selectAll"], selected: [] })
  const byName = await agent.act({ steps: [{ ref: "Local keys", action: "select", args: ["openai KEY"] }] })
  expect(byName.ok, byName.error?.message).toBe(true)
  const byId = await agent.act({ steps: [{ ref: "Local keys", action: "select", args: ["github"] }] })
  expect(byId.ok, byId.error?.message).toBe(true)
  expect(onSelectedChange).toHaveBeenLastCalledWith(["openai", "github"], expect.objectContaining({ source: "agent" }))
  expect(listEntry()?.selected).toEqual(["OpenAI key", "GitHub token"])
  const off = await agent.act({ steps: [{ ref: "Local keys", action: "select", args: ["OpenAI key", false] }] })
  expect(off.ok, off.error?.message).toBe(true)
  expect(listEntry()?.selected).toEqual(["GitHub token"])
})

test("two quick agent steps on a controlled list both count", async () => {
  render(<ControlledSecrets />)
  const result = await agent.act({
    steps: [
      { ref: "Local keys", action: "select", args: ["openai"] },
      { ref: "Local keys", action: "select", args: ["github"] },
    ],
  })
  expect(result.ok, result.error?.message).toBe(true)
  await waitFor(() => expect(listEntry()?.selected).toEqual(["OpenAI key", "GitHub token"]))
})

test("an agent's selectAll checks every selectable secret, and its select of a disabled one fails with the reason", async () => {
  render(<Secrets />)
  const all = await agent.act({ steps: [{ ref: "Local keys", action: "selectAll", args: [true] }] })
  expect(all.ok, all.error?.message).toBe(true)
  expect(listEntry()?.selected).toEqual(["OpenAI key", "GitHub token"])
  const refused = await agent.act({ steps: [{ ref: "Local keys", action: "select", args: ["Stripe key"] }] })
  expect(refused.ok).toBe(false)
  expect(refused.error?.message).toContain(
    "select isn't available: Stripe key can't be selected: Already on your account",
  )
  expect(isChecked("Stripe key")).toBe("false")
})

test("an unknown name fails with why, and a list that isn't selectable refuses both actions", async () => {
  const { unmount } = render(<Secrets />)
  const unknown = await agent.act({ steps: [{ ref: "Local keys", action: "select", args: ["AWS key"] }] })
  expect(unknown.error?.message).toContain(`select has no secret named "AWS key"`)
  unmount()
  render(<Secrets selectable={false} />)
  expect(screen.queryByRole("checkbox")).toBeNull()
  for (const action of ["select", "selectAll"]) {
    const result = await agent.act({ steps: [{ ref: "Local keys", action, args: ["openai"] }] })
    expect(result.ok).toBe(false)
    expect(result.error?.message).toContain(`${action} isn't available: the list isn't selectable`)
  }
})

test("the row checkboxes are left to the list's actions: agents see only named components", () => {
  render(<Secrets />)
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  expect(components.some((entry) => entry.component === "checkbox")).toBe(false)
  for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
})

test("has no axe violations with a selection and a disabled row", async () => {
  const { container } = render(
    <main>
      <Secrets defaultSelected={["openai"]} />
    </main>,
  )
  await act(async () => {})
  expect(await axeViolations(container)).toEqual([])
})

test("agents reach the list by its name: one component is called API keys, and select, replace and delete all run", async () => {
  approve = true
  const onSelectedChange = vi.fn()
  const onReplace = vi.fn()
  const onDelete = vi.fn()
  render(
    <Secrets aria-label="API keys" onSelectedChange={onSelectedChange} onReplace={onReplace} onDelete={onDelete} />,
  )
  expect(screen.getByRole("list", { name: "API keys" })).toBeTruthy()
  const named = agent.snapshot().filter((entry) => !entry.offPage && entry.label === "API keys")
  expect(named.map((entry) => entry.component)).toEqual(["secret-list"])
  const selected = await agent.act({ steps: [{ ref: "API keys", action: "select", args: ["GitHub token"] }] })
  expect(selected.ok, selected.error?.message).toBe(true)
  expect(onSelectedChange).toHaveBeenLastCalledWith(["github"], expect.anything())
  const replaced = await agent.act({ steps: [{ ref: "API keys", action: "replace", args: ["github"] }] })
  expect(replaced.ok, replaced.error?.message).toBe(true)
  expect(onReplace).toHaveBeenCalledWith("github")
  const deleting = await agent.act({ steps: [{ ref: "API keys", action: "delete", args: ["github"] }] })
  expect(deleting.ok, deleting.error?.message).toBe(true)
  await screen.findByRole("alertdialog", { name: "Delete this secret?" })
  const confirmed = await agent.act({
    steps: [{ ref: "Delete this secret?", action: "press", args: ["Delete secret"] }],
  })
  expect(confirmed.ok, confirmed.error?.message).toBe(true)
  expect(onDelete).toHaveBeenCalledWith("github")
  const press = await agent.act({ steps: [{ ref: "Replace OpenAI key", action: "press" }] })
  expect(press.ok, press.error?.message).toBe(true)
  expect(onReplace).toHaveBeenLastCalledWith("openai")
})
