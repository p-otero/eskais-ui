import { afterEach, beforeEach, expect, test, vi } from "vitest"

import {
  barProfile,
  elapsedDateTime,
  formatElapsed,
  levelFromDb,
  rms,
  silenceDb,
  smoothLevel,
  stepLevel,
  toDbfs,
} from "@/lib/audio-level"
import { audioContextStatus, createAudioMeter, primeAudioContext } from "@/lib/audio-meter"
import { microphoneError, requestMicrophone, stopStream } from "@/lib/microphone"

import { audio, fakeStream, installFakeAudio, pendingFrames, setHidden, stepFrames } from "./fake-audio"

beforeEach(installFakeAudio)
afterEach(() => {
  setHidden(false)
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

test("rms and dBFS: a full-scale square is 0 dBFS, silence the floor", () => {
  expect(rms([1, -1, 1, -1])).toBe(1)
  expect(rms([])).toBe(0)
  expect(rms([0.5, -0.5])).toBeCloseTo(0.5)
  expect(toDbfs(1)).toBe(0)
  expect(toDbfs(0.1)).toBeCloseTo(-20)
  expect(toDbfs(0)).toBe(silenceDb)
  expect(toDbfs(Number.NaN)).toBe(silenceDb)
  expect(toDbfs(1e-9)).toBe(silenceDb)
})

test("the level is linear in decibels between the floor and the ceiling, clamped", () => {
  expect(levelFromDb(-60)).toBe(0)
  expect(levelFromDb(-12)).toBe(1)
  expect(levelFromDb(-36)).toBeCloseTo(0.5)
  expect(levelFromDb(-90)).toBe(0)
  expect(levelFromDb(0)).toBe(1)
  expect(levelFromDb(-30, -50, -10)).toBeCloseTo(0.5)
  expect(levelFromDb(-20, -10, -10)).toBe(0)
})

test("attack rises faster than release falls, the same at any frame rate", () => {
  const up = smoothLevel(0, 1, 16, 30, 250)
  const down = smoothLevel(1, 0, 16, 30, 250)
  expect(up).toBeGreaterThan(0.4)
  expect(1 - down).toBeLessThan(0.1)
  let at60 = 0
  for (let frame = 0; frame < 6; frame += 1) at60 = smoothLevel(at60, 1, 1000 / 60, 30, 250)
  let at120 = 0
  for (let frame = 0; frame < 12; frame += 1) at120 = smoothLevel(at120, 1, 1000 / 120, 30, 250)
  expect(at60).toBeCloseTo(at120, 6)
  expect(smoothLevel(0.3, 1, 0, 30, 250)).toBe(0.3)
  expect(smoothLevel(0.3, 1, 16, 0, 0)).toBe(1)
})

test("stepped levels and the reduced-motion profile", () => {
  expect(stepLevel(0.4, 4)).toBe(0.5)
  expect(stepLevel(0.1, 4)).toBe(0)
  expect(stepLevel(1.4, 4)).toBe(1)
  expect(stepLevel(0.37, 0)).toBe(0.37)
  expect(barProfile(0, 1)).toBe(1)
  const profile = Array.from({ length: 5 }, (_, index) => barProfile(index, 5))
  expect(profile[2]).toBe(1)
  expect(profile[0]).toBeCloseTo(profile[4] ?? 0)
  expect(Math.min(...profile)).toBeGreaterThanOrEqual(0.5)
})

test("elapsed time reads m:ss, then h:mm:ss", () => {
  expect(formatElapsed(0)).toBe("0:00")
  expect(formatElapsed(9.9)).toBe("0:09")
  expect(formatElapsed(75)).toBe("1:15")
  expect(formatElapsed(3725)).toBe("1:02:05")
  expect(formatElapsed(-3)).toBe("0:00")
  expect(elapsedDateTime(75.4)).toBe("PT75S")
})

test("the meter writes the level to custom properties and rises with the sound", () => {
  const target = document.createElement("div")
  const onFrame = vi.fn()
  const meter = createAudioMeter(fakeStream(), { target, onFrame })
  expect(audio.contexts).toHaveLength(1)
  expect(audio.contexts[0]?.state).toBe("running")
  stepFrames(5)
  expect(target.style.getPropertyValue("--voice-level")).toBe("0.000")
  audio.amplitude = 0.1
  stepFrames(10)
  const loud = Number(target.style.getPropertyValue("--voice-level"))
  expect(loud).toBeGreaterThan(0.8)
  expect(meter.level()).toBeCloseTo(loud, 2)
  expect(onFrame.mock.lastCall?.[0].level).toBeCloseTo(loud, 2)
  audio.amplitude = 0
  stepFrames(2)
  expect(Number(target.style.getPropertyValue("--voice-level"))).toBeGreaterThan(0.5)
  meter.stop()
  expect(target.style.getPropertyValue("--voice-level")).toBe("")
})

test("bars keep recent levels, newest last, one per interval", () => {
  const target = document.createElement("div")
  const meter = createAudioMeter(fakeStream(), { target, bars: 4, barInterval: 64 })
  audio.amplitude = 0.1
  stepFrames(4)
  expect(Number(target.style.getPropertyValue("--voice-bar-3"))).toBeGreaterThan(0.5)
  expect(target.style.getPropertyValue("--voice-bar-2")).toBe("0.000")
  audio.amplitude = 0
  stepFrames(64)
  expect(Number(target.style.getPropertyValue("--voice-bar-3"))).toBeLessThan(0.02)
  meter.stop()
  expect(target.style.getPropertyValue("--voice-bar-0")).toBe("")
})

test("under reduced motion the level moves in steps and the bars hold a still profile", () => {
  const target = document.createElement("div")
  const onFrame = vi.fn()
  const meter = createAudioMeter(fakeStream(), { target, bars: 3, steps: 4, onFrame })
  audio.amplitude = 0.01
  stepFrames(30)
  expect(target.style.getPropertyValue("--voice-level")).toBe("0.500")
  expect(target.style.getPropertyValue("--voice-bar-1")).toBe("0.500")
  expect(Number(target.style.getPropertyValue("--voice-bar-0"))).toBeLessThan(0.5)
  const writes = onFrame.mock.calls.length
  stepFrames(30)
  expect(onFrame.mock.calls.length).toBe(writes)
  meter.stop()
})

test("meters share one AudioContext, which closes when the last one stops", () => {
  const first = createAudioMeter(fakeStream())
  const second = createAudioMeter(fakeStream())
  expect(audio.contexts).toHaveLength(1)
  expect(audioContextStatus()).toEqual({ holders: 2, state: "running" })
  first.stop()
  first.stop()
  expect(audio.contexts[0]?.state).toBe("running")
  second.stop()
  expect(audio.contexts[0]?.state).toBe("closed")
  expect(audioContextStatus().holders).toBe(0)
  expect(pendingFrames()).toBe(0)
  expect(audio.nodes.every((node) => !node.connected)).toBe(true)
})

test("a hidden page stops the frames and closes the context; showing it starts again", () => {
  const meter = createAudioMeter(fakeStream())
  expect(pendingFrames()).toBe(1)
  setHidden(true)
  expect(pendingFrames()).toBe(0)
  expect(audio.contexts[0]?.state).toBe("closed")
  setHidden(false)
  expect(pendingFrames()).toBe(1)
  expect(audio.contexts).toHaveLength(2)
  meter.stop()
  expect(audio.contexts[1]?.state).toBe("closed")
})

test("the meter stops when the stream's audio ends, by the device or by track.stop()", () => {
  const unplugged = fakeStream()
  const onEnd = vi.fn()
  createAudioMeter(unplugged, { onEnd })
  unplugged.track.end()
  expect(onEnd).toHaveBeenCalledOnce()
  expect(pendingFrames()).toBe(0)
  expect(audio.contexts[0]?.state).toBe("closed")

  const stopped = fakeStream()
  const onStop = vi.fn()
  createAudioMeter(stopped, { onEnd: onStop })
  stopStream(stopped)
  stepFrames(1)
  expect(onStop).toHaveBeenCalledOnce()
  expect(pendingFrames()).toBe(0)
})

test("a stream without live audio never starts a context", () => {
  const stream = fakeStream()
  stream.track.stop()
  const meter = createAudioMeter(stream)
  expect(audio.contexts).toHaveLength(0)
  expect(meter.level()).toBe(0)
})

test("priming in a gesture opens the context the first meter takes over; unused, it closes", () => {
  vi.useFakeTimers()
  primeAudioContext()
  primeAudioContext()
  expect(audioContextStatus()).toEqual({ holders: 1, state: "running" })
  const meter = createAudioMeter(fakeStream())
  expect(audioContextStatus().holders).toBe(1)
  meter.stop()
  expect(audio.contexts[0]?.state).toBe("closed")

  primeAudioContext()
  vi.advanceTimersByTime(10_000)
  expect(audio.contexts[1]?.state).toBe("closed")
})

const fail = (name: string) => () => Promise.reject(new DOMException("no", name))

test("requestMicrophone maps getUserMedia's errors onto denied and error", async () => {
  const stream = fakeStream()
  const getUserMedia = vi.fn(() => Promise.resolve(stream))
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } })
  expect(await requestMicrophone()).toEqual({ state: "listening", stream })
  expect(getUserMedia).toHaveBeenCalledWith({ audio: expect.objectContaining({ echoCancellation: true }) })

  getUserMedia.mockImplementation(fail("NotAllowedError"))
  expect(await requestMicrophone(true)).toMatchObject({ state: "denied", error: "not-allowed" })
  getUserMedia.mockImplementation(fail("NotFoundError"))
  expect(await requestMicrophone()).toMatchObject({ state: "error", error: "not-found" })
  getUserMedia.mockImplementation(fail("NotReadableError"))
  expect(await requestMicrophone()).toMatchObject({ state: "error", error: "not-readable" })
  expect(microphoneError(new DOMException("", "SecurityError"))).toBe("not-allowed")
  expect(microphoneError("nope")).toBe("unknown")

  vi.stubGlobal("navigator", {})
  vi.stubGlobal("isSecureContext", false)
  expect(await requestMicrophone()).toEqual({ state: "error", error: "insecure-context" })
  vi.stubGlobal("isSecureContext", true)
  expect(await requestMicrophone()).toEqual({ state: "error", error: "unsupported" })
})
