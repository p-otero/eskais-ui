import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { checkServer, mount } from "@ui-sdk/core/testing"
import { createAgent } from "@ui-sdk/react/agent"
import { Profiler, useState } from "react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

import {
  VoiceInput,
  voiceInputTone,
  type VoiceInputProps,
  type VoiceInputState,
  type VoiceInputStateDetails,
} from "@/components/ui/voice-input"
import { voiceInput } from "@/components/ui/voice-input-primitive"
import { ActionRefusedError } from "@/lib/action-refusal"
import { readAnnouncements } from "@/lib/test-utils"

import { axeViolations } from "./axe"
import { audio, fakeStream, installFakeAudio, pendingFrames, stepFrames } from "./fake-audio"

const agent = createAgent()

beforeEach(({ task }) => {
  if (!/^(primitive|agent):/.test(task.name)) installFakeAudio()
})
afterEach(() => vi.unstubAllGlobals())

function Harness({
  initial = "idle",
  outcome = "listening",
  onRender,
  ...props
}: Partial<VoiceInputProps> & {
  initial?: VoiceInputState
  outcome?: VoiceInputState
  onRender?: () => void
}) {
  const [state, setState] = useState<VoiceInputState>(initial)
  const [stream, setStream] = useState<MediaStream | null>(initial === "listening" ? fakeStream() : null)
  return (
    <Profiler id="voice" onRender={() => onRender?.()}>
      <VoiceInput
        {...props}
        state={state}
        stream={stream}
        onStart={(details) => {
          props.onStart?.(details)
          setState("requesting")
          queueMicrotask(() => {
            if (outcome === "listening") setStream(fakeStream())
            setState(outcome)
          })
        }}
        onConfirm={(details) => {
          props.onConfirm?.(details)
          setState("processing")
          setStream(null)
        }}
        onCancel={(details) => {
          props.onCancel?.(details)
          setState("idle")
          setStream(null)
        }}
      />
    </Profiler>
  )
}

const group = () => screen.getByRole("group", { name: "Voice input" })
const dictate = () => screen.getByRole("button", { name: "Dictate" })

test("primitive: start, confirm and cancel ask for the next state only where they apply", () => {
  const onStateChange = vi.fn()
  const view = mount(voiceInput, { defaultState: "idle", onStateChange }, `<root aria-label="Probe"></root>`)
  try {
    expect(() => view.api.confirm()).toThrow("confirm isn't available while idle.")
    expect(() => view.api.cancel()).toThrow("cancel isn't available while idle.")
    expect(view.api.confirm(undefined, "trigger-press")).toBe(false)
    expect(view.api.start()).toBe(true)
    expect(onStateChange).toHaveBeenLastCalledWith("requesting", expect.objectContaining({ reason: "imperative" }))
    expect(view.root.getAttribute("data-state")).toBe("requesting")
    expect(view.root.getAttribute("aria-busy")).toBe("true")
    expect(() => view.api.start()).toThrow(ActionRefusedError)
    expect(view.api.toggle()).toBe(true)
    expect(onStateChange).toHaveBeenLastCalledWith("idle", expect.objectContaining({ reason: "trigger-press" }))
  } finally {
    view.unmount()
  }
})

test("primitive: Escape cancels only while listening, and states are announced", async () => {
  const onStateChange = vi.fn()
  const view = mount(
    voiceInput,
    { defaultState: "listening", onStateChange, announcements: { processing: "Processing", idle: "Stopped" } },
    `<root tabindex="-1" aria-label="Probe"></root>`,
  )
  try {
    view.root.focus()
    await view.keys("Escape")
    expect(onStateChange).toHaveBeenLastCalledWith("idle", expect.objectContaining({ reason: "escape-key" }))
    expect(view.announced).toContain("Stopped")
    onStateChange.mockClear()
    await view.keys("Escape")
    expect(onStateChange).not.toHaveBeenCalled()
  } finally {
    view.unmount()
  }
})

test("primitive: a disabled voice input doesn't start, and it renders on the server", () => {
  const view = mount(voiceInput, { disabled: true }, `<root aria-label="Probe"></root>`)
  try {
    expect(() => view.api.start()).toThrow("start isn't available while disabled.")
    expect(view.root.hasAttribute("data-disabled")).toBe(true)
  } finally {
    view.unmount()
  }
  checkServer(voiceInput, { state: "listening" }, `<root></root>`)
})

test("the toggle starts listening, the ring follows the level and pressing it again keeps what was said", async () => {
  const user = userEvent.setup()
  const onStart = vi.fn()
  const onConfirm = vi.fn()
  render(<Harness onStart={onStart} onConfirm={onConfirm} />)
  expect(dictate().getAttribute("aria-pressed")).toBe("false")
  await user.click(dictate())
  expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ reason: "trigger-press" }))
  await waitFor(() => expect(group().dataset.state).toBe("listening"))
  expect(dictate().getAttribute("aria-pressed")).toBe("true")
  await waitFor(() => expect(readAnnouncements().polite).toBe("Listening"))

  audio.amplitude = 0.1
  act(() => stepFrames(10))
  expect(Number(group().style.getPropertyValue("--voice-level"))).toBeGreaterThan(0.8)

  await user.click(dictate())
  expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ reason: "trigger-press" }))
  expect(group().dataset.state).toBe("processing")
  expect(group().getAttribute("aria-busy")).toBe("true")
  expect(dictate().getAttribute("aria-disabled")).toBe("true")
  expect(group().style.getPropertyValue("--voice-level")).toBe("")
  expect(pendingFrames()).toBe(0)
  expect(audio.contexts.every((context) => context.state === "closed")).toBe(true)
})

test("the level reaches the page without a React render per frame", async () => {
  const onRender = vi.fn()
  render(<Harness initial="listening" variant="bar" onRender={onRender} />)
  await act(async () => {})
  onRender.mockClear()
  audio.amplitude = 0.05
  act(() => stepFrames(120))
  expect(Number(group().style.getPropertyValue("--voice-bar-23"))).toBeGreaterThan(0.5)
  expect(onRender).not.toHaveBeenCalled()
})

test("Space and Enter toggle from the keyboard; Escape cancels and keeps focus on the toggle", async () => {
  const user = userEvent.setup()
  const onCancel = vi.fn()
  render(<Harness variant="bar" onCancel={onCancel} />)
  await user.tab()
  expect(document.activeElement).toBe(dictate())
  await user.keyboard(" ")
  await waitFor(() => expect(group().dataset.state).toBe("listening"))
  await user.keyboard("{Escape}")
  expect(onCancel).toHaveBeenCalledWith(expect.objectContaining({ reason: "escape-key" }))
  expect(group().dataset.state).toBe("idle")
  expect(document.activeElement).toBe(dictate())
  await user.keyboard("{Enter}")
  await waitFor(() => expect(group().dataset.state).toBe("listening"))
})

test("the bar: cancel discards and hands focus to the toggle; the timer reads the elapsed time", async () => {
  const user = userEvent.setup()
  const onCancel = vi.fn()
  render(<Harness initial="listening" variant="bar" elapsed={75} onCancel={onCancel} />)
  expect(screen.getByText("1:15").closest("time")?.getAttribute("datetime")).toBe("PT75S")
  expect(screen.getByText("Recording time")).toBeTruthy()
  expect(group().querySelectorAll("[data-slot=voice-input-bar]")).toHaveLength(24)
  expect(group().querySelector("[data-slot=voice-input-waveform]")?.getAttribute("aria-hidden")).toBe("true")
  const cancel = screen.getByRole("button", { name: "Cancel recording" })
  await user.click(cancel)
  expect(onCancel).toHaveBeenCalledWith(expect.objectContaining({ reason: "close-press" }))
  expect(screen.queryByRole("button", { name: "Cancel recording" })).toBeNull()
  expect(document.activeElement).toBe(dictate())
  expect(screen.queryByText("1:15")).toBeNull()
})

test("startedAt counts whole seconds and holds still once listening stops", () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] })
  try {
    const startedAt = Date.now()
    const { rerender } = render(<VoiceInput variant="bar" state="listening" startedAt={startedAt} />)
    expect(screen.getByText("0:00")).toBeTruthy()
    act(() => vi.advanceTimersByTime(3100))
    expect(screen.getByText("0:03")).toBeTruthy()
    rerender(<VoiceInput variant="bar" state="processing" startedAt={startedAt} />)
    act(() => vi.advanceTimersByTime(5000))
    expect(screen.getByText("0:03")).toBeTruthy()
  } finally {
    vi.useRealTimers()
  }
})

test("denied and error show in the destructive tone, say why, and the toggle tries again", async () => {
  const user = userEvent.setup()
  const onStart = vi.fn()
  render(<Harness variant="bar" outcome="denied" onStart={onStart} />)
  await user.click(dictate())
  await waitFor(() => expect(group().dataset.state).toBe("denied"))
  expect(group().querySelector("[data-slot=voice-input-message]")?.textContent).toBe("Microphone access denied")
  await waitFor(() => expect(readAnnouncements().polite).toBe("Microphone access denied"))
  expect(group().className).toContain("bg-destructive-soft")
  expect(voiceInputTone("denied")).toBe("destructive")
  expect(voiceInputTone("listening")).toBe("neutral")
  await user.click(dictate())
  expect(onStart).toHaveBeenCalledTimes(2)
})

test("labels translate every name and announcement", async () => {
  const user = userEvent.setup()
  render(
    <Harness
      variant="bar"
      labels={{ group: "Entrada de voz", toggle: "Dictar", cancel: "Cancelar grabación", listening: "Escuchando" }}
    />,
  )
  await user.click(screen.getByRole("button", { name: "Dictar" }))
  await waitFor(() => expect(readAnnouncements().polite).toBe("Escuchando"))
  expect(screen.getByRole("group", { name: "Entrada de voz" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "Cancelar grabación" })).toBeTruthy()
})

test("unmounting while listening stops the frames and closes the AudioContext", async () => {
  const { unmount } = render(<Harness initial="listening" />)
  await act(async () => {})
  expect(pendingFrames()).toBe(1)
  unmount()
  expect(pendingFrames()).toBe(0)
  expect(audio.contexts.at(-1)?.state).toBe("closed")
})

test("agent: finds the voice input by its label and starts, confirms and cancels it", async () => {
  const onStart = vi.fn()
  render(<Harness variant="bar" onStart={onStart} />)
  const entry = agent.snapshot().find((item) => item.label === "Voice input" && !item.offPage)
  expect(entry?.actions).toEqual(expect.arrayContaining(["start", "confirm", "cancel"]))
  for (const item of agent.snapshot().filter((candidate) => !candidate.offPage)) {
    expect(item.label, `${item.component} ${item.ref} has no name`).toBeTruthy()
  }

  let result = await agent.act({ steps: [{ ref: "Voice input", action: "start" }] })
  expect(result.ok, result.error?.message).toBe(true)
  expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ source: "agent" }))
  await waitFor(() => expect(group().dataset.state).toBe("listening"))
  result = await agent.act({ steps: [{ ref: "Voice input", action: "confirm" }] })
  expect(result.ok, result.error?.message).toBe(true)
  expect(group().dataset.state).toBe("processing")
  result = await agent.act({ steps: [{ ref: "Voice input", action: "cancel" }] })
  expect(result.ok, result.error?.message).toBe(true)
  expect(group().dataset.state).toBe("idle")
})

const refuse = (details: VoiceInputStateDetails) => {
  if (details.source === "agent") details.cancel()
}

test("agent: a start the app refuses fails the step and leaves the voice input idle", async () => {
  const onStart = vi.fn(refuse)
  const { unmount } = render(<VoiceInput onStart={onStart} />)
  const result = await agent.act({ steps: [{ ref: "Voice input", action: "start" }] })
  expect(result.ok).toBe(false)
  expect(result.error?.message).toContain("start was refused by the app.")
  expect(onStart).toHaveBeenCalledOnce()
  expect(group().dataset.state).toBe("idle")
  unmount()

  const onStateChange = vi.fn((_next: VoiceInputState, details: VoiceInputStateDetails) => refuse(details))
  render(<VoiceInput state="listening" onStateChange={onStateChange} />)
  for (const action of ["confirm", "cancel"]) {
    const refused = await agent.act({ steps: [{ ref: "Voice input", action }] })
    expect(refused.ok, action).toBe(false)
    expect(refused.error?.message).toContain(`${action} was refused by the app.`)
  }
  expect(group().dataset.state).toBe("listening")
})

test("agent: an action the state doesn't offer fails the step with the state", async () => {
  const onStateChange = vi.fn()
  const { rerender } = render(<VoiceInput state="processing" onStateChange={onStateChange} />)
  const start = await agent.act({ steps: [{ ref: "Voice input", action: "start" }] })
  expect(start.ok).toBe(false)
  expect(start.error?.message).toContain("start isn't available while processing.")
  rerender(<VoiceInput state="idle" onStateChange={onStateChange} />)
  for (const action of ["confirm", "cancel"]) {
    const result = await agent.act({ steps: [{ ref: "Voice input", action }] })
    expect(result.error?.message, action).toContain(`${action} isn't available while idle.`)
  }
  rerender(<VoiceInput state="idle" disabled onStateChange={onStateChange} />)
  const disabled = await agent.act({ steps: [{ ref: "Voice input", action: "start" }] })
  expect(disabled.ok).toBe(false)
  expect(onStateChange).not.toHaveBeenCalled()
  expect(group().dataset.state).toBe("idle")
})

test("a press the app refuses does nothing and throws nothing", async () => {
  const onStateChange = vi.fn((_next: VoiceInputState, details: VoiceInputStateDetails) => details.cancel())
  render(<VoiceInput onStateChange={onStateChange} />)
  await userEvent.click(dictate())
  expect(onStateChange).toHaveBeenCalledWith("requesting", expect.objectContaining({ reason: "trigger-press" }))
  expect(group().dataset.state).toBe("idle")
})

test("both variants pass axe in every state", async () => {
  const states: VoiceInputState[] = ["idle", "requesting", "listening", "processing", "error", "denied"]
  for (const state of states) {
    const { container, unmount } = render(
      <div>
        <VoiceInput state={state} />
        <VoiceInput variant="bar" state={state} elapsed={4} labels={{ group: "Voice input in the bar" }} />
      </div>,
    )
    expect(await axeViolations(container), state).toEqual([])
    unmount()
  }
})

test("a press on the toggle while processing does nothing", () => {
  const onStateChange = vi.fn()
  render(<VoiceInput state="processing" onStateChange={onStateChange} />)
  fireEvent.click(dictate())
  expect(onStateChange).not.toHaveBeenCalled()
})

test("only listening reads the stream, even when one is still passed", () => {
  const stream = fakeStream()
  const { rerender } = render(<VoiceInput state="processing" stream={stream} />)
  expect(pendingFrames()).toBe(0)
  expect(audio.contexts).toHaveLength(0)
  rerender(<VoiceInput state="listening" stream={stream} />)
  expect(pendingFrames()).toBe(1)
  rerender(<VoiceInput state="idle" stream={stream} />)
  expect(pendingFrames()).toBe(0)
  expect(audio.contexts[0]?.state).toBe("closed")
})
