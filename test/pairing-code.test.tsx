import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { checkServer } from "@ui-sdk/core/testing"
import { createAgent } from "@ui-sdk/react/agent"
import { beforeEach, expect, test, vi } from "vitest"

import { PairingCode, PairingCodeInput, type PairingCodeInputProps } from "@/components/ui/pairing-code"
import {
  comparePairingCodeGroups,
  editPairingCode,
  formatPairingCode,
  normalizePairingCode,
} from "@/components/ui/pairing-code-format"
import { pairingCode } from "@/components/ui/pairing-code-primitive"
import { readAnnouncements } from "@/lib/test-utils"

import { axeViolations } from "./axe"

const RFC_ALPHABET = "BCDFGHJKLMNPQRSTVWXZ"
const format = { alphabet: RFC_ALPHABET, length: 8, groupSize: 4, separator: "-" }

const agent = createAgent()

const writeText = vi.fn((_text: string) => Promise.resolve())

beforeEach(() => {
  writeText.mockClear()
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true })
})

function typeInto(input: HTMLInputElement, value: string, caret = value.length, inputType = "insertText") {
  input.value = value
  input.setSelectionRange(caret, caret)
  fireEvent.input(input, { inputType })
}

function codeField(name: string | RegExp = "Device code") {
  return screen.getByRole<HTMLInputElement>("textbox", { name })
}

function groupStates() {
  return Array.from(document.querySelectorAll("[data-slot=pairing-code-group]"), (group) =>
    group.getAttribute("data-match"),
  )
}

function CodeInput(props: Partial<PairingCodeInputProps>) {
  return <PairingCodeInput label="Device code" length={8} alphabet={RFC_ALPHABET} {...props} />
}

test("format: normalizes case and separators, keeps the alphabet and the length", () => {
  expect(normalizePairingCode("bcdf-ghjk", format)).toBe("BCDFGHJK")
  expect(normalizePairingCode(" bc df_gh jk lm ", format)).toBe("BCDFGHJK")
  expect(normalizePairingCode("ab1e-cd", format)).toBe("BCD")
  expect(normalizePairingCode("ab1e-cd", {})).toBe("AB1ECD")
  expect(formatPairingCode("BCDFGHJK", { groupSize: 4, separator: "-" })).toBe("BCDF-GHJK")
  expect(formatPairingCode("BCDFGH", { groupSize: 3, separator: " · " })).toBe("BCD · FGH")
})

test("format: an edit keeps the caret after the same characters, and a deleted separator takes its neighbour", () => {
  expect(editPairingCode("BCDF", "BCDFG", 5, format, undefined)).toEqual({ value: "BCDF-G", code: "BCDFG", caret: 6 })
  expect(editPairingCode("BCDFGH", "BXCDF-GH", 2, format, undefined)).toEqual({
    value: "BXCD-FGH",
    code: "BXCDFGH",
    caret: 2,
  })
  expect(editPairingCode("BCDFGH", "BCDFGH", 4, format, "backward")).toEqual({
    value: "BCDG-H",
    code: "BCDGH",
    caret: 3,
  })
  expect(editPairingCode("BCDFGH", "BCDFGH", 4, format, "forward")).toEqual({
    value: "BCDF-H",
    code: "BCDFH",
    caret: 4,
  })
})

test("format: groups compare as match, mismatch or pending", () => {
  expect(comparePairingCodeGroups("", "BCDFGHJK", 4)).toEqual(["pending", "pending"])
  expect(comparePairingCodeGroups("BCDFG", "BCDFGHJK", 4)).toEqual(["match", "pending"])
  expect(comparePairingCodeGroups("BCDFX", "BCDFGHJK", 4)).toEqual(["match", "mismatch"])
  expect(comparePairingCodeGroups("BCDFGHJK", "BCDFGHJK", 4)).toEqual(["match", "match"])
})

test("primitive: renders on the server as a named group", () => {
  checkServer(pairingCode, {}, `<root aria-label="Pairing code"></root>`)
})

test("shows the code in groups, hides them from screen readers and spells it out instead", () => {
  render(<PairingCode code="bcdf ghjk" label="Pairing code" />)
  const root = screen.getByRole("group", { name: "Pairing code" })
  const groups = root.querySelectorAll("[data-slot=pairing-code-group]")
  expect(Array.from(groups, (group) => group.textContent)).toEqual(["BCDF", "GHJK"])
  expect(root.querySelector("[data-slot=pairing-code-separator]")?.textContent).toBe("-")
  expect(groups[0]?.closest("[aria-hidden=true]")).toBeTruthy()
  expect(root.querySelector(".sr-only")?.textContent).toBe("B C D F, G H J K")
  expect(root.querySelector("[data-slot=pairing-code-value]")?.getAttribute("translate")).toBe("no")
})

test("groupSize, separator and labels.spell shape the code and what's read", () => {
  render(
    <PairingCode
      code="BCDFGH"
      label="Pairing code"
      groupSize={3}
      separator=" "
      labels={{ spell: (groups) => groups.join(" then ") }}
    />,
  )
  const root = screen.getByRole("group", { name: "Pairing code" })
  expect(Array.from(root.querySelectorAll("[data-slot=pairing-code-group]"), (group) => group.textContent)).toEqual([
    "BCD",
    "FGH",
  ])
  expect(root.querySelector(".sr-only")?.textContent).toBe("BCD then FGH")
})

test("Copy writes the code with its separators, says Copied and runs onCopy", async () => {
  const onCopy = vi.fn()
  render(<PairingCode code="bcdfghjk" label="Pairing code" onCopy={onCopy} />)
  fireEvent.click(screen.getByRole("button", { name: "Copy code" }))
  await screen.findByRole("button", { name: "Copied" })
  expect(writeText).toHaveBeenCalledWith("BCDF-GHJK")
  expect(onCopy).toHaveBeenCalledWith("BCDF-GHJK")
  await waitFor(() => expect(readAnnouncements().polite).toBe("Code copied"))
})

test("agents read the code and copy it", async () => {
  render(<PairingCode code="bcdfghjk" label="Pairing code" />)
  const entry = agent.snapshot().find((candidate) => candidate.label === "Pairing code")
  expect(entry).toMatchObject({ component: "pairing-code", code: "BCDF-GHJK", actions: ["copy", "confirm"] })
  const result = await agent.act({ steps: [{ ref: "Pairing code", action: "copy" }] })
  expect(result.ok, result.error?.message).toBe(true)
  await waitFor(() => expect(writeText).toHaveBeenCalledWith("BCDF-GHJK"))
})

test("agentHidden keeps the code out of the snapshot and queries, refuses an agent's copy, and still copies for a person", async () => {
  render(<PairingCode code="bcdfghjk" label="Secret pairing code" agentHidden />)
  const snapshot = agent.snapshot().filter((entry) => !entry.offPage)
  const everything = JSON.stringify([snapshot, await agent.query({ text: "BCDF" })])
  expect(everything).not.toContain("BCDF")
  expect(everything).not.toContain("B C D F")
  expect(snapshot.find((entry) => entry.label === "Copy code")).toBeUndefined()
  const result = await agent.act({ steps: [{ ref: "Secret pairing code", action: "copy" }] })
  expect(result.ok).toBe(false)
  expect(result.error?.message).toContain("copy isn't available: the code is hidden from agents")
  expect(writeText).not.toHaveBeenCalled()
  expect(document.querySelector("[data-slot=pairing-code-value]")?.hasAttribute("data-agent-hidden")).toBe(true)
  fireEvent.click(screen.getByRole("button", { name: "Copy code" }))
  await waitFor(() => expect(writeText).toHaveBeenCalledWith("BCDF-GHJK"))
})

test("confirm: the two answers call onConfirm, and an agent can answer with true or false", async () => {
  const onConfirm = vi.fn()
  render(
    <PairingCode
      code="BCDFGHJK"
      label="Pairing code"
      compare="confirm"
      text={{ prompt: "Does it match the other screen?", matches: "It matches", mismatch: "It's different" }}
      onConfirm={onConfirm}
    />,
  )
  expect(screen.getByText("Does it match the other screen?")).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "It's different" }))
  expect(onConfirm).toHaveBeenLastCalledWith(false)
  fireEvent.click(screen.getByRole("button", { name: "It matches" }))
  expect(onConfirm).toHaveBeenLastCalledWith(true)
  const result = await agent.act({ steps: [{ ref: "Pairing code", action: "confirm", args: [false] }] })
  expect(result.ok, result.error?.message).toBe(true)
  expect(onConfirm).toHaveBeenLastCalledWith(false)
  expect(screen.getByRole("group", { name: "Pairing code" }).getAttribute("data-matches")).toBe("false")
})

test("enter: each group shows match, mismatch or pending with an icon, and the status says so", () => {
  const onMatchChange = vi.fn()
  render(
    <PairingCode
      code="BCDF-GHJK"
      label="Pairing code"
      compare="enter"
      text={{ label: "Code on your device", matches: "Codes match", mismatch: "Codes don't match" }}
      onMatchChange={onMatchChange}
    />,
  )
  const status = screen.getByRole("status")
  expect(groupStates()).toEqual(["pending", "pending"])
  expect(document.querySelectorAll("[data-slot=pairing-code-group-state] svg")).toHaveLength(2)
  const input = codeField("Code on your device")
  act(() => typeInto(input, "bcdf g"))
  expect(input.value).toBe("BCDF-G")
  expect(groupStates()).toEqual(["match", "pending"])
  expect(status.textContent).toBe("")
  act(() => typeInto(input, "BCDF-GX"))
  expect(groupStates()).toEqual(["match", "mismatch"])
  expect(status.textContent).toBe("Codes don't match")
  expect(status.querySelector("svg")).toBeTruthy()
  act(() => typeInto(input, "bcdfghjk"))
  expect(groupStates()).toEqual(["match", "match"])
  expect(status.textContent).toBe("Codes match")
  expect(onMatchChange).toHaveBeenCalledTimes(1)
  expect(onMatchChange).toHaveBeenLastCalledWith(true)
  act(() => typeInto(input, "BCDF-GHJ", 8, "deleteContentBackward"))
  expect(onMatchChange).toHaveBeenLastCalledWith(false)
})

test("enter with agentHidden: the field is out of the agent's reach", async () => {
  render(
    <PairingCode
      code="BCDFGHJK"
      label="Pairing code"
      compare="enter"
      agentHidden
      text={{ label: "Code on your device", matches: "Codes match", mismatch: "Codes don't match" }}
    />,
  )
  expect(agent.snapshot().some((entry) => !entry.offPage && entry.label === "Code on your device")).toBe(false)
  const result = await agent.act({ steps: [{ ref: "Code on your device", action: "setValue", args: ["BCDFGHJK"] }] })
  expect(result.ok).toBe(false)
  expect(codeField("Code on your device").value).toBe("")
})

test("confirm is refused outside confirm mode, while hidden, and without a boolean", async () => {
  const { unmount } = render(<PairingCode code="BCDFGHJK" label="Plain code" />)
  const plain = await agent.act({ steps: [{ ref: "Plain code", action: "confirm", args: [true] }] })
  expect(plain.error?.message).toContain("confirm isn't available: this code isn't compared by confirmation")
  unmount()
  render(
    <>
      <PairingCode
        code="BCDFGHJK"
        label="Hidden code"
        agentHidden
        compare="confirm"
        text={{ matches: "Yes", mismatch: "No" }}
      />
      <PairingCode code="BCDFGHJK" label="Shown code" compare="confirm" text={{ matches: "Same", mismatch: "Other" }} />
    </>,
  )
  const hidden = await agent.act({ steps: [{ ref: "Hidden code", action: "confirm", args: [true] }] })
  expect(hidden.error?.message).toContain("confirm isn't available: the code is hidden from agents")
  const vague = await agent.act({ steps: [{ ref: "Shown code", action: "confirm", args: ["yes"] }] })
  expect(vague.error?.message).toContain("confirm takes true when the codes match and false when they don't")
})

test("input: types upper case, inserts the separator itself and keeps the caret after what was typed", () => {
  const onChange = vi.fn()
  render(<CodeInput onChange={onChange} />)
  const input = codeField()
  act(() => typeInto(input, "bcdfg"))
  expect(input.value).toBe("BCDF-G")
  expect(input.selectionStart).toBe(6)
  expect(onChange).toHaveBeenLastCalledWith("BCDFG")
  act(() => typeInto(input, "BXCDF-G", 2))
  expect(input.value).toBe("BXCD-FG")
  expect(input.selectionStart).toBe(2)
})

test("input: a character outside the alphabet is dropped and the field stays as it was", () => {
  const onChange = vi.fn()
  render(<CodeInput defaultValue="BCD" onChange={onChange} />)
  const input = codeField()
  act(() => typeInto(input, "BCDA", 4))
  expect(input.value).toBe("BCD")
  act(() => typeInto(input, "BCD1", 4))
  expect(input.value).toBe("BCD")
  expect(onChange).not.toHaveBeenCalled()
})

test("input: deleting just after or before a separator removes the character beside it", () => {
  render(<CodeInput defaultValue="BCDFGH" />)
  const input = codeField()
  expect(input.value).toBe("BCDF-GH")
  act(() => typeInto(input, "BCDFGH", 4, "deleteContentBackward"))
  expect(input.value).toBe("BCDG-H")
  expect(input.selectionStart).toBe(3)
  act(() => typeInto(input, "BCDGH", 4, "deleteContentForward"))
  expect(input.value).toBe("BCDG")
  expect(input.selectionStart).toBe(4)
})

test("input: a pasted code fills the field with or without separators, filtered and cut to the length", () => {
  const onComplete = vi.fn()
  render(<CodeInput onComplete={onComplete} />)
  const input = codeField()
  act(() => typeInto(input, " bcdf–ghjk ", 11, "insertFromPaste"))
  expect(input.value).toBe("BCDF-GHJK")
  expect(onComplete).toHaveBeenCalledWith("BCDFGHJK")
  act(() => typeInto(input, "", 0, "deleteContentBackward"))
  act(() => typeInto(input, "b-1c-a-dfghjkLMN", 16, "insertFromPaste"))
  expect(input.value).toBe("BCDF-GHJK")
})

test("input: onComplete runs once when the code fills, and again after an edit refills it", () => {
  const onComplete = vi.fn()
  render(<CodeInput onComplete={onComplete} />)
  const input = codeField()
  act(() => typeInto(input, "BCDFGHJ"))
  expect(onComplete).not.toHaveBeenCalled()
  act(() => typeInto(input, "BCDF-GHJK"))
  expect(onComplete).toHaveBeenCalledTimes(1)
  act(() => typeInto(input, "BCDF-GHJKL"))
  expect(onComplete).toHaveBeenCalledTimes(1)
  act(() => typeInto(input, "BCDF-GHJ", 8, "deleteContentBackward"))
  act(() => typeInto(input, "BCDF-GHJL"))
  expect(onComplete).toHaveBeenCalledTimes(2)
  expect(onComplete).toHaveBeenLastCalledWith("BCDFGHJL")
})

test("input: autocomplete, spelling and capitalization hints, and a name from the label", () => {
  render(<CodeInput />)
  const input = codeField()
  expect(input.getAttribute("autocomplete")).toBe("off")
  expect(input.getAttribute("spellcheck")).toBe("false")
  expect(input.getAttribute("autocapitalize")).toBe("characters")
  expect(input.getAttribute("inputmode")).toBe("text")
})

test("input: pending makes it read-only and busy; an error is a live alert and marks it invalid", async () => {
  const { rerender } = render(<CodeInput pending />)
  const input = codeField()
  expect(input.readOnly).toBe(true)
  expect(input.getAttribute("aria-busy")).toBe("true")
  rerender(<CodeInput error="We couldn't find that code." />)
  const alert = await screen.findByRole("alert")
  expect(alert.textContent).toContain("We couldn't find that code.")
  expect(input.getAttribute("aria-invalid")).toBe("true")
  expect(input.getAttribute("aria-describedby")).toContain(alert.id)
  expect(input.readOnly).toBe(false)
})

test("input: an agent types a code through the field, normalized, and it completes", async () => {
  const onComplete = vi.fn()
  render(<CodeInput onComplete={onComplete} />)
  const result = await agent.act({ steps: [{ ref: "Device code", action: "setValue", args: ["bcdf ghjk"] }] })
  expect(result.ok, result.error?.message).toBe(true)
  expect(codeField().value).toBe("BCDF-GHJK")
  expect(onComplete).toHaveBeenCalledWith("BCDFGHJK")
})

test("input: agentHidden hides the field from agents", () => {
  render(<CodeInput agentHidden />)
  expect(agent.snapshot().some((entry) => !entry.offPage && entry.label === "Device code")).toBe(false)
})

test("input: id, data-*, aria-*, focus and key handlers and inputMode reach the input; className and style the wrapper", () => {
  const onFocus = vi.fn()
  const onBlur = vi.fn()
  const onKeyDown = vi.fn()
  render(
    <>
      <span id="code-hint">Eight letters</span>
      <CodeInput
        id="device-code"
        data-testid="device-code"
        data-track="pairing"
        aria-describedby="code-hint"
        aria-busy={true}
        inputMode="numeric"
        // oxlint-disable-next-line jsx-a11y/no-autofocus -- checks that autoFocus reaches the input
        autoFocus
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        className="max-w-sm"
        style={{ minWidth: 0 }}
      />
    </>,
  )
  const input = screen.getByTestId<HTMLInputElement>("device-code")
  expect(input).toBe(codeField())
  expect(input.id).toBe("device-code")
  expect(input.getAttribute("data-track")).toBe("pairing")
  expect(input.getAttribute("aria-describedby")).toContain("code-hint")
  expect(input.hasAttribute("aria-busy")).toBe(false)
  expect(input.getAttribute("inputmode")).toBe("numeric")
  expect(document.activeElement).toBe(input)
  expect(onFocus).toHaveBeenCalled()
  fireEvent.keyDown(input, { key: "Enter" })
  expect(onKeyDown).toHaveBeenCalledTimes(1)
  fireEvent.blur(input)
  expect(onBlur).toHaveBeenCalledTimes(1)
  const wrapper = input.closest<HTMLElement>("[data-slot=pairing-code-input]")
  expect(wrapper?.className).toContain("max-w-sm")
  expect(wrapper?.style.minWidth).toBe("0px")
})

test("input: a passed aria-describedby joins the field's description and error", async () => {
  render(
    <>
      <span id="code-hint">Eight letters</span>
      <CodeInput aria-describedby="code-hint" aria-invalid={false} description="On the device" error="Not found." />
    </>,
  )
  const alert = await screen.findByRole("alert")
  const describedBy = codeField().getAttribute("aria-describedby") ?? ""
  expect(describedBy).toContain("code-hint")
  expect(describedBy).toContain(alert.id)
  expect(codeField().getAttribute("aria-invalid")).toBe("true")
})

test("the code's root takes id and data-*, and keeps its own slot and name", () => {
  render(<PairingCode code="BCDFGHJK" label="Pairing code" id="shown-code" data-testid="shown-code" />)
  const root = screen.getByTestId("shown-code")
  expect(root.id).toBe("shown-code")
  expect(root.getAttribute("data-slot")).toBe("pairing-code")
  expect(screen.getByRole("group", { name: "Pairing code" })).toBe(root)
})

test("a controlled input shows the value it's given, formatted", () => {
  const { rerender } = render(<CodeInput value="bcdf" />)
  expect(codeField().value).toBe("BCDF")
  rerender(<CodeInput value="BCDFGH" />)
  expect(codeField().value).toBe("BCDF-GH")
})

test("every control is named, and there are no axe violations in each mode", async () => {
  const { container } = render(
    <>
      <PairingCode code="BCDFGHJK" label="Plain code" size="lg" />
      <PairingCode code="BCDFGHJK" label="Confirmed code" compare="confirm" text={{ matches: "Yes", mismatch: "No" }} />
      <PairingCode
        code="BCDFGHJK"
        label="Entered code"
        compare="enter"
        text={{ label: "Code on your device", matches: "Codes match", mismatch: "Codes don't match" }}
      />
      <CodeInput error="Not found" />
    </>,
  )
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  expect(within(container).getAllByRole("group").length).toBeGreaterThanOrEqual(3)
  expect(await axeViolations(container)).toEqual([])
})
