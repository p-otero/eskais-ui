import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { useState } from "react"
import { expect, test, vi } from "vitest"
import { z } from "zod"

import { Field, FieldLabel } from "@/components/ui/field"
import { Form, FormActions, FormField } from "@/components/ui/form"
import { settleLabels } from "@/components/ui/token-input-labels"
import {
  createTokenInputController,
  TokenInput,
  TokenInputEditor,
  type TokenInputValue,
} from "@/components/ui/token-input"

import { axeViolations } from "./axe"

const agent = createAgent()

const startingLabels = ["bug", "ui"] as const

function Labels({
  initial = startingLabels,
  onChange,
  max,
}: {
  initial?: readonly string[]
  onChange?: (labels: string[]) => void
  max?: number
}) {
  const [labels, setLabels] = useState<readonly string[]>(initial)
  return (
    <Field>
      <FieldLabel>Labels</FieldLabel>
      <TokenInput
        tokenType="label"
        value={labels}
        max={max}
        validate={(label) => label !== "nope"}
        onValueChange={(next) => {
          setLabels(next)
          onChange?.(next)
        }}
      >
        <TokenInputEditor placeholder="Add a label" />
      </TokenInput>
    </Field>
  )
}

function chips() {
  return [...document.querySelectorAll("[data-slot=token-input-token]")].map((chip) => chip.textContent)
}

async function typeAtEnd(text: string) {
  const user = userEvent.setup()
  const editor = screen.getByRole("textbox", { name: "Labels" })
  await user.click(editor)
  act(() => {
    const range = document.createRange()
    range.selectNodeContents(editor)
    range.collapse(false)
    getSelection()?.removeAllRanges()
    getSelection()?.addRange(range)
  })
  if (text) await user.keyboard(text)
  return { user, editor }
}

test("renders each label as a chip inside a labelled text box, with no axe violations", async () => {
  const { container } = render(<Labels />)
  const editor = screen.getByRole("textbox", { name: "Labels" })
  expect(editor.getAttribute("aria-multiline")).toBe("true")
  expect(editor.getAttribute("aria-placeholder")).toBe("Add a label")
  expect(chips()).toEqual(["bug", "ui"])
  expect(container.querySelector("[data-slot=token-input]")?.contains(editor)).toBe(true)
  expect(container.querySelector("[data-slot=token-input-token]")?.getAttribute("data-token-type")).toBe("label")
  expect(await axeViolations(container)).toEqual([])
})

test("each chip's remove button is named for pointer users and hidden from assistive technology", () => {
  render(<Labels />)
  const remove = document.querySelector("[data-slot=token-input-token-remove]")
  expect(remove?.getAttribute("title")).toBe("Remove bug")
  expect(remove?.getAttribute("aria-hidden")).toBe("true")
  expect(remove?.classList.contains("touch-target")).toBe(true)
})

test("labels override the remove name and tone colours the chips", () => {
  render(
    <TokenInput
      aria-label="Topics"
      tokenType="topic"
      defaultValue={["docs"]}
      tone="violet"
      labels={{ remove: (label) => `Quitar ${label}` }}
    >
      <TokenInputEditor aria-label="Topics" />
    </TokenInput>,
  )
  const chip = document.querySelector("[data-slot=token-input-token]")
  expect([...(chip?.classList ?? [])]).toEqual(
    expect.arrayContaining(["bg-violet-soft", "text-violet-soft-foreground", "border-violet-border"]),
  )
  expect(document.querySelector("[data-slot=token-input-token-remove]")?.getAttribute("title")).toBe("Quitar docs")
})

test("a comma or Enter turns the typed text into a label", async () => {
  const onChange = vi.fn()
  render(<Labels onChange={onChange} />)
  await typeAtEnd("docs,")
  expect(chips()).toEqual(["bug", "ui", "docs"])
  expect(onChange).toHaveBeenLastCalledWith(["bug", "ui", "docs"])
  await typeAtEnd("good first issue{Enter}")
  expect(chips()).toEqual(["bug", "ui", "docs", "good first issue"])
  expect(onChange).toHaveBeenLastCalledWith(["bug", "ui", "docs", "good first issue"])
})

test("Backspace removes the label before the caret and undo brings it back", async () => {
  const onChange = vi.fn()
  render(<Labels onChange={onChange} />)
  const { user } = await typeAtEnd("{Backspace}")
  expect(chips()).toEqual(["bug"])
  expect(onChange).toHaveBeenLastCalledWith(["bug"])
  await user.keyboard("{Control>}z{/Control}")
  expect(chips()).toEqual(["bug", "ui"])
  expect(onChange).toHaveBeenLastCalledWith(["bug", "ui"])
})

test("the remove button removes its label", async () => {
  const onChange = vi.fn()
  render(<Labels onChange={onChange} />)
  const remove = document.querySelectorAll<HTMLElement>("[data-slot=token-input-token-remove]")[0]!
  fireEvent.mouseDown(remove)
  fireEvent.click(remove)
  expect(chips()).toEqual(["ui"])
  expect(onChange).toHaveBeenLastCalledWith(["ui"])
})

test("a paste splits on commas and line breaks, keeping new labels only", async () => {
  // user-event's ClipboardEvent isn't jsdom's, which UI SDK's strict event check rejects; the paste itself is real.
  globalThis.__UI_SDK_STRICT__ = false
  render(<Labels />)
  const { user } = await typeAtEnd("")
  await user.paste("docs, bug\nperf")
  globalThis.__UI_SDK_STRICT__ = true
  expect(chips()).toEqual(["bug", "ui", "docs", "perf"])
})

test("a label that fails validate or passes max stays as text to fix", async () => {
  render(<Labels max={3} />)
  const { editor } = await typeAtEnd("nope,")
  expect(chips()).toEqual(["bug", "ui"])
  expect(editor.textContent).toContain("nope")

  expect(settleLabels(["a, b, c, d"], { type: "label", max: 3 }, true)).toEqual([
    expect.objectContaining({ label: "a" }),
    expect.objectContaining({ label: "b" }),
    expect.objectContaining({ label: "c" }),
    "d",
  ])
  expect(settleLabels(["a, nope, b"], { type: "label", validate: (l) => l !== "nope" }, false)).toEqual([
    expect.objectContaining({ label: "a" }),
    "nope, b",
  ])
})

test("a controlled value replaces the labels, readonly arrays included", () => {
  const frozen: readonly string[] = Object.freeze(["one", "two"])
  const { rerender } = render(
    <TokenInput aria-label="Tags" tokenType="tag" value={frozen}>
      <TokenInputEditor aria-label="Tags" />
    </TokenInput>,
  )
  expect(chips()).toEqual(["one", "two"])
  rerender(
    <TokenInput aria-label="Tags" tokenType="tag" value={["three"] as const}>
      <TokenInputEditor aria-label="Tags" />
    </TokenInput>,
  )
  expect(chips()).toEqual(["three"])
})

test("without tokenType it holds UI SDK's text and tokens, from a readonly value", () => {
  const draft: readonly (string | { type: string; value: string; label: string })[] = Object.freeze([
    "Explain ",
    { type: "file", value: "src/routes.ts", label: "routes.ts" },
  ])
  const onValueChange = vi.fn<(value: TokenInputValue) => void>()
  const [controller] = [createTokenInputController()]
  render(
    <Field>
      <FieldLabel>Prompt</FieldLabel>
      <TokenInput defaultValue={draft} controller={controller} onValueChange={onValueChange}>
        <TokenInputEditor />
      </TokenInput>
    </Field>,
  )
  expect(chips()).toEqual(["routes.ts"])
  expect(screen.getByRole("textbox", { name: "Prompt" }).textContent).toContain("Explain")
  act(() => {
    controller.insert({ type: "file", value: "README.md", label: "README.md" }, { at: "end" })
  })
  expect(chips()).toEqual(["routes.ts", "README.md"])
  expect(onValueChange).toHaveBeenCalled()
})

test("inside FormField it binds string[] values, shows the schema's error and floats its label", async () => {
  const schema = z.object({ labels: z.array(z.string()).min(1) })
  const onSubmit = vi.fn()
  const user = userEvent.setup()
  render(
    <Form schema={schema} defaultValues={{ labels: [] }} onSubmit={onSubmit} label="Issue">
      <FormField name="labels" label="Labels" labelPlacement="in">
        <TokenInput tokenType="label">
          <TokenInputEditor />
        </TokenInput>
      </FormField>
      <FormActions submitLabel="Save" />
    </Form>,
  )
  const field = document.querySelector("[data-slot=field]")!
  expect(field?.getAttribute("data-label-placement")).toBe("in")
  await user.click(screen.getByRole("button", { name: "Save" }))
  await waitFor(() => expect(screen.getByRole("textbox", { name: /Labels/ }).getAttribute("aria-invalid")).toBe("true"))
  expect(onSubmit).not.toHaveBeenCalled()

  await typeAtEnd("bug{Enter}")
  expect(chips()).toEqual(["bug"])
  await user.click(screen.getByRole("button", { name: "Save" }))
  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ labels: ["bug"] }, expect.anything()))
})

test("an agent finds it by its label and sets labels as text", async () => {
  const onChange = vi.fn()
  render(<Labels onChange={onChange} />)
  const entry = agent.snapshot().find((item) => !item.offPage && item.label === "Labels")
  expect(entry?.component).toBe("token-input")
  expect(entry?.actions).toEqual(expect.arrayContaining(["setValue", "insert", "removeToken", "clear"]))

  const result = await agent.act({ steps: [{ ref: "Labels", action: "setValue", args: ["perf, docs"] }] })
  expect(result.ok, result.error?.message).toBe(true)
  expect(chips()).toEqual(["perf", "docs"])
  expect(onChange).toHaveBeenLastCalledWith(["perf", "docs"])

  const cleared = await agent.act({ steps: [{ ref: "Labels", action: "clear" }] })
  expect(cleared.ok, cleared.error?.message).toBe(true)
  expect(chips()).toEqual([])
})
