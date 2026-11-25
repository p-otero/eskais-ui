import { isRecord } from "@/lib/narrow"

/** Work split into short steps: each `yield` hands the main thread back before the next step. */
type IdleJob = Generator<void, void, void>

const inputEvents = ["keydown", "pointerdown", "pointermove", "wheel", "touchstart"] as const

function inputPending() {
  const scheduling: unknown = "scheduling" in navigator ? navigator.scheduling : undefined
  if (!isRecord(scheduling) || typeof scheduling.isInputPending !== "function") return false
  return scheduling.isInputPending() === true
}

/**
 * Runs one job a step per frame, and only once input has been quiet for `quietMs` and none is waiting, so static
 * repaints happen between key presses and never in a frame one needs. A press pauses the job; `run` replaces it.
 */
function createIdleWork(quietMs: number) {
  let lastInputAt = Number.NEGATIVE_INFINITY
  let job: IdleJob | null = null
  let startAt = 0
  let timer = 0
  let frame = 0
  const noteInput = (event: Event) => {
    if (event.type === "pointermove" && event instanceof PointerEvent && event.buttons === 0) return
    lastInputAt = performance.now()
  }
  for (const type of inputEvents) addEventListener(type, noteInput, { capture: true, passive: true })

  const quietIn = () => Math.max(startAt, lastInputAt + quietMs) - performance.now()

  const cancel = () => {
    clearTimeout(timer)
    cancelAnimationFrame(frame)
    timer = 0
    frame = 0
  }

  const step = () => {
    timer = 0
    if (!job) return
    const wait = quietIn()
    if (wait > 0 || inputPending()) {
      timer = window.setTimeout(step, Math.max(wait, 16))
      return
    }
    if (job.next().done) {
      job = null
      return
    }
    afterNextFrame()
  }

  function afterNextFrame() {
    frame = requestAnimationFrame(() => {
      frame = 0
      timer = window.setTimeout(step, 0)
    })
  }

  return {
    /** Starts `next` after `delayMs`, dropping any job not finished yet. */
    run(next: IdleJob, delayMs = 0) {
      cancel()
      job = next
      startAt = performance.now() + delayMs
      timer = window.setTimeout(step, delayMs)
    },
    /** Runs a job to its end at once, dropping any job waiting. */
    finish(next: IdleJob) {
      cancel()
      job = null
      let result = next.next()
      while (!result.done) result = next.next()
    },
    /** Milliseconds since the last key press, click, drag or wheel. */
    sinceInput: () => performance.now() - lastInputAt,
    /** True when a key press or click is waiting for the main thread, where the browser can tell. */
    inputWaiting: inputPending,
    /** True when input has been quiet long enough for a short step of static work. */
    quiet: () => quietIn() <= 0 && !inputPending(),
    stop() {
      cancel()
      job = null
    },
    dispose() {
      cancel()
      job = null
      for (const type of inputEvents) removeEventListener(type, noteInput, { capture: true })
    },
  }
}

export { createIdleWork }
export type { IdleJob }
