import { announce, css, definePrimitive, dispatch, prepareAnnouncements, type ChangeDetails } from "@ui-sdk/core"

/**
 * `photo` before anything runs, `detecting` while points light up over it, `building` while the photo turns into
 * the base model, `refining` while weights stream in, `ready` to orbit, `error` to retry.
 */
type ModelScanStage = "photo" | "detecting" | "building" | "refining" | "ready" | "error"

/** A point on the photo, each value a fraction of its width or height from its top left corner. */
type ModelScanPoint = { x: number; y: number }

type ModelScanActionReason = "trigger-press" | "imperative"

type ModelScanAnnouncements = {
  stage: (stage: ModelScanStage) => string | undefined
  /** `percent` is a whole number from 0 to 100. */
  progress: (percent: number) => string
  error: string
}

type ModelScanOptions = {
  stage?: ModelScanStage
  /** From 0 to 1 within the stage; undefined while the engine can't tell. */
  progress?: number
  onCancel?: (value: null, details: ChangeDetails<ModelScanActionReason>) => void
  onRetry?: (value: null, details: ChangeDetails<ModelScanActionReason>) => void
  /** The photo's width over its height. */
  ratio?: number
  /** The model has taken the photo's place in the 3D scene. */
  introDone?: boolean
  announcements?: ModelScanAnnouncements
}

const working: readonly ModelScanStage[] = ["detecting", "building", "refining"]
const cancelable: readonly ModelScanStage[] = ["photo", ...working]

const clamp = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
const percentOf = (value: number) => `${String(Math.round(clamp(value) * 10_000) / 100)}%`

// Progress is read at most every tenth, and no sooner than this after the last reading.
const progressStep = 10
const progressInterval = 2000

const modelScan = definePrimitive({
  name: "model-scan",
  options: {
    stage: "string",
    progress: "number",
    onCancel: "callback",
    onRetry: "callback",
    ratio: "number",
    introDone: "boolean",
    announcements: "value",
  },
  controlled: ["stage"],
  state: (options: ModelScanOptions) => ({
    stage: options.stage ?? "photo",
    progress: options.progress,
    ratio: options.ratio ?? 3 / 4,
    introDone: options.introDone ?? false,
  }),
  sync: (options) => ({
    stage: options.stage ?? "photo",
    progress: options.progress,
    ratio: options.ratio ?? 3 / 4,
    introDone: options.introDone ?? false,
  }),
  api: (context) => {
    const { store } = context
    // A call that can't apply throws, so an agent's step fails with why instead of reporting success.
    const run = (name: "onCancel" | "onRetry", allowed: readonly ModelScanStage[], event?: Event) => {
      const current = store.get().stage
      const action = name.slice(2)
      if (!allowed.includes(current)) {
        throw new Error(`${action} works only in ${allowed.join(", ")} (stage: ${current}).`)
      }
      if (!context.options()[name]) throw new Error(`${action} isn't offered: there is no ${name}.`)
      return !dispatch(context, name, null, { reason: event ? "trigger-press" : "imperative", event })
    }
    return {
      /** Stops the run at any stage before it's ready, through `onCancel`. */
      cancel: (event?: Event) => run("onCancel", cancelable, event),
      /** Starts again after an error, through `onRetry`. */
      retry: (event?: Event) => run("onRetry", ["error"], event),
      canCancel: () => cancelable.includes(store.get().stage) && Boolean(context.options().onCancel),
      announcements: () => context.options().announcements,
    }
  },
  slots: (slot) => ({
    root: slot({
      role: "group",
      attrs: (state) => ({
        "data-stage": state.stage,
        "data-intro": state.introDone ? "done" : undefined,
        "aria-busy": working.includes(state.stage) ? "true" : undefined,
        style: css({
          "--model-scan-ratio": String(state.ratio),
          "--model-scan-progress": state.progress === undefined ? undefined : String(clamp(state.progress)),
        }),
      }),
      bind: (el, part) => {
        const doc = el.ownerDocument
        prepareAnnouncements(doc)
        let { stage } = part.store.get()
        let lastStep = -1
        let lastTime = -Infinity
        return part.store.subscribe(() => {
          const state = part.store.get()
          const messages = part.api.announcements()
          if (state.stage !== stage) {
            stage = state.stage
            lastStep = -1
            lastTime = -Infinity
            if (!messages) return
            if (stage === "error") announce(messages.error, { doc, priority: "assertive" })
            else {
              const text = messages.stage(stage)
              if (text) announce(text, { doc })
            }
            return
          }
          if (!working.includes(state.stage) || state.progress === undefined || !messages) return
          const percent = Math.round(clamp(state.progress) * 100)
          const step = Math.floor(percent / progressStep)
          const now = Date.now()
          if (step === lastStep || (now - lastTime < progressInterval && percent < 100)) return
          lastStep = step
          lastTime = now
          announce(messages.progress(percent), { doc })
        })
      },
    }),
    // Once the 3D scene shows the photo exactly where the 2D one is, the 2D layer goes.
    photo: slot<{ handedOff?: boolean }>({
      props: { handedOff: "boolean" },
      attrs: (state, part) => ({
        "data-stage": state.stage,
        "data-handed-off": part.props.handedOff ? "" : undefined,
      }),
    }),
    effect: slot({
      present: (state) => state.stage === "detecting",
      attrs: (state) => ({
        "aria-hidden": "true",
        "data-determinate": state.progress === undefined ? undefined : "",
      }),
    }),
    points: slot<{ handedOff?: boolean }>({
      props: { handedOff: "boolean" },
      present: (state, part) => state.stage === "detecting" || (state.stage === "building" && !part.props.handedOff),
      attrs: () => ({ "aria-hidden": "true" }),
    }),
    point: slot<{ id: string; point: ModelScanPoint; index?: number }>({
      props: { id: "string", point: "value", index: "number" },
      attrs: (_state, part) => ({
        style: css({
          left: percentOf(part.props.point.x),
          top: percentOf(part.props.point.y),
          "--model-scan-point-index": String(part.props.index ?? 0),
        }),
      }),
    }),
  }),
  agent: { actions: ["cancel", "retry"] },
})

export { modelScan }
export type { ModelScanActionReason, ModelScanAnnouncements, ModelScanOptions, ModelScanPoint, ModelScanStage }
