import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import axe from "axe-core"
import { expect, test } from "vitest"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { SearchField } from "@/components/ui/search-field"

async function axeViolations(root: Element) {
  const result = await axe.run(root, { rules: { "color-contrast": { enabled: false } } })
  return result.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.html).join(", ")}`)
}

test("card parts expose slots and accept a render element", () => {
  render(
    <Card render={<section aria-label="Usage" />}>
      <CardHeader>
        <CardTitle render={<h2>Usage</h2>} />
        <CardDescription>This month</CardDescription>
      </CardHeader>
      <CardContent>42 builds</CardContent>
      <CardFooter>Updated today</CardFooter>
    </Card>,
  )
  const card = screen.getByRole("region", { name: "Usage" })
  expect(card.dataset.slot).toBe("card")
  expect(screen.getByRole("heading", { level: 2, name: "Usage" }).dataset.slot).toBe("card-title")
})

test("a badge tone maps to semantic tokens, and a tone passed as variant still works", () => {
  render(
    <>
      <Badge tone="warning">Stale</Badge>
      <Badge tone="neutral" variant="outline">
        Draft
      </Badge>
    </>,
  )
  const stale = screen.getByText("Stale")
  expect(stale.dataset.tone).toBe("warning")
  expect(stale.className).toContain("text-warning")
  const draft = screen.getByText("Draft")
  expect(draft.dataset.tone).toBe("neutral")
  expect(draft.className).toContain("bg-secondary")
})

test("badge variants map to semantic tokens", () => {
  render(
    <>
      <Badge variant="success">Ready</Badge>
      <Badge render={<a href="#builds">Builds</a>} />
    </>,
  )
  const ready = screen.getByText("Ready")
  expect(ready.dataset.variant).toBe("success")
  expect(ready.dataset.tone).toBe("success")
  expect(ready.className).toContain("text-success")
  expect(screen.getByRole("link", { name: "Builds" }).dataset.slot).toBe("badge")
})

test("a page built from the catalog has no axe violations, closed or with a dialog open", async () => {
  const user = userEvent.setup()
  const { container } = render(
    <main>
      <h1>Projects</h1>
      <SearchField label="Search projects" onSearch={() => {}} />
      <Field>
        <FieldLabel>Project name</FieldLabel>
        <Input />
        <FieldDescription>Shown on the dashboard.</FieldDescription>
      </Field>
      <Card>
        <CardHeader>
          <CardTitle>Apollo</CardTitle>
          <CardDescription>
            <Badge variant="info">Preview</Badge>
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button variant="secondary">Open</Button>
          <ConfirmDialog
            trigger="Delete project"
            title="Delete Apollo?"
            confirmLabel="Delete forever"
            tone="destructive"
            agentConfirm="Deletes the project"
            onConfirm={() => {}}
          />
        </CardFooter>
      </Card>
    </main>,
  )
  expect(await axeViolations(container)).toEqual([])
  await user.click(screen.getByRole("button", { name: "Delete project" }))
  expect(await axeViolations(document.body)).toEqual([])
})
