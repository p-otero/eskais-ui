import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { createIdleWork, type IdleJob } from "@/components/ui/live-sky-idle"

const quietMs = 250

function* job(done: string[], name: string, steps: number): IdleJob {
  for (let step = 1; step <= steps; step++) {
    done.push(`${name}${String(step)}`)
    if (step < steps) yield
  }
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ["setTimeout", "clearTimeout", "requestAnimationFrame", "cancelAnimationFrame", "performance"],
  })
})

afterEach(() => {
  vi.useRealTimers()
})

test("a job runs a step per frame once its delay has passed", () => {
  const idle = createIdleWork(quietMs)
  const done: string[] = []
  idle.run(job(done, "a", 3), 100)
  vi.advanceTimersByTime(90)
  expect(done).toEqual([])
  vi.advanceTimersByTime(11)
  expect(done).toEqual(["a1"])
  const perFrame: number[] = []
  for (let frame = 0; frame < 6; frame++) {
    const before = done.length
    vi.advanceTimersByTime(16)
    perFrame.push(done.length - before)
  }
  expect(Math.max(...perFrame)).toBe(1)
  expect(done).toEqual(["a1", "a2", "a3"])
  idle.dispose()
})

test("a key press holds the next step until input has been quiet", () => {
  const idle = createIdleWork(quietMs)
  const done: string[] = []
  idle.run(job(done, "a", 3))
  vi.advanceTimersByTime(5)
  expect(done).toEqual(["a1"])
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }))
  vi.advanceTimersByTime(quietMs - 20)
  expect(done).toEqual(["a1"])
  expect(idle.quiet()).toBe(false)
  vi.advanceTimersByTime(80)
  expect(done).toEqual(["a1", "a2", "a3"])
  expect(idle.quiet()).toBe(true)
  idle.dispose()
})

test("a new job drops the one not finished, and finish runs one to its end at once", () => {
  const idle = createIdleWork(quietMs)
  const done: string[] = []
  idle.run(job(done, "a", 3))
  vi.advanceTimersByTime(5)
  idle.run(job(done, "b", 2))
  vi.advanceTimersByTime(200)
  expect(done).toEqual(["a1", "b1", "b2"])
  idle.run(job(done, "c", 2), 100)
  idle.finish(job(done, "d", 3))
  vi.advanceTimersByTime(300)
  expect(done).toEqual(["a1", "b1", "b2", "d1", "d2", "d3"])
  idle.dispose()
})
