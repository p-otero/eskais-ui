import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { useState } from "react"
import { expect, test, vi } from "vitest"

import { RepositorySelect, type Repository } from "@/components/ui/repository-select"

const repositories: Repository[] = [
  { value: "api", name: "api", path: "~/work/acme/api", branch: "main", ahead: 0, behind: 0, remote: true },
  {
    value: "app",
    name: "app",
    path: "~/work/acme/app",
    branch: "feat/onboarding",
    uncommitted: 5,
    ahead: 2,
    behind: 7,
    remote: true,
  },
  { value: "docs", name: "docs", path: "~/work/acme/docs", branch: "main", uncommitted: 1, remote: false },
]

function Picker({ onChange }: { onChange?: (value: string | null) => void }) {
  const [value, setValue] = useState<string | null>("api")
  return (
    <RepositorySelect
      aria-label="Repository"
      repositories={repositories}
      value={value}
      onValueChange={(next) => {
        setValue(next)
        onChange?.(next)
      }}
    />
  )
}

test("the trigger shows the name; each option shows its path, branch and state", async () => {
  const user = userEvent.setup()
  render(<Picker />)
  const trigger = screen.getByRole("combobox", { name: "Repository" })
  expect(trigger.textContent).toBe("api")
  await user.click(trigger)
  const app = await screen.findByRole("option", { name: /^app/ })
  expect(within(app).getByText("~/work/acme/app")).toBeTruthy()
  expect(within(app).getByText("feat/onboarding").closest("[data-slot=git-branch-chip]")).not.toBeNull()
  expect(within(app).getByText("5 uncommitted")).toBeTruthy()
  expect(within(app).getByText("2 ahead")).toBeTruthy()
  expect(within(app).getByText("7 behind")).toBeTruthy()
  const docs = screen.getByRole("option", { name: /^docs/ })
  expect(within(docs).getByText("No remote")).toBeTruthy()
  expect(within(screen.getByRole("option", { name: /^api/ })).getByText("Up to date")).toBeTruthy()
})

test("keyboard: arrows and Enter choose a repository", async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<Picker onChange={onChange} />)
  screen.getByRole("combobox", { name: "Repository" }).focus()
  await user.keyboard("{ArrowDown}")
  await screen.findByRole("listbox")
  await user.keyboard("{ArrowDown}{Enter}")
  expect(onChange).toHaveBeenLastCalledWith("app")
  expect(screen.getByRole("combobox", { name: "Repository" }).textContent).toBe("app")
})

test("labels replace every word", async () => {
  const user = userEvent.setup()
  render(
    <RepositorySelect
      aria-label="Repositorio"
      repositories={repositories}
      defaultValue="api"
      labels={{
        uncommitted: (n) => `${String(n)} sin confirmar`,
        ahead: (n) => `${String(n)} por delante`,
        behind: (n) => `${String(n)} por detrás`,
        noRemote: "Sin remoto",
        upToDate: "Al día",
      }}
    />,
  )
  await user.click(screen.getByRole("combobox", { name: "Repositorio" }))
  expect(await screen.findByText("5 sin confirmar")).toBeTruthy()
  expect(screen.getByText("Sin remoto")).toBeTruthy()
  expect(screen.getByText("Al día")).toBeTruthy()
})

test("agents choose a repository by name", async () => {
  const agent = createAgent()
  const onChange = vi.fn()
  render(<Picker onChange={onChange} />)
  const result = await agent.act({ steps: [{ ref: "Repository", action: "setValue", args: ["docs"] }] })
  expect(result.ok).toBe(true)
  expect(onChange).toHaveBeenLastCalledWith("docs")
})
