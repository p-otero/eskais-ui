import { announce, css, definePrimitive, dispatch, prepareAnnouncements, type ChangeDetails } from "@ui-sdk/core"

import { settled, unavailable } from "@/lib/action-refusal"

/**
 * `photo` before anything runs, `detecting` while points light up over it, `building` while the photo turns into
 * the base model, `refining` while weights stream in, `ready` to orbit, `error` to retry.
 */
type ModelScanStage = "photo" | "detecting" | "building" | "refining" | "ready" | "error"

type ModelScanActionReason = "trigger-press" | "imperative"

type ModelScanAnnouncements = {
  stage: (stage: ModelScanStage) => string | undefined
  /** `percent` is a whole number from 0 to 100. */
  progress: (percent: number) => string
  error: string
}

type ModelScanCallback = (value: null, details: ChangeDetails<ModelScanActionReason>) => void

type ModelScanOptions = {
  stage?: ModelScanStage
  /** From 0 to 1 within the stage; undefined while the engine can't tell. */
  progress?: number
  onStart?: ModelScanCallback
  onCancel?: ModelScanCallback
  onRetry?: ModelScanCallback
  onStartOver?: ModelScanCallback
  onDownload?: ModelScanCallback
  /** The photo's width over its height. */
  ratio?: number
  /** The model has taken the photo's place in the 3D scene. */
  introDone?: boolean
  announcements?: ModelScanAnnouncements
}

const working: readonly ModelScanStage[] = ["detecting", "building", "refining"]

type ModelScanAction = "start" | "cancel" | "retry" | "restart" | "download"
type ModelScanCallbackName = "onStart" | "onCancel" | "onRetry" | "onStartOver" | "onDownload"

// Each action, the callback it runs and the stages that offer it.
const actions: Record<ModelScanAction, { callback: ModelScanCallbackName; stages: readonly ModelScanStage[] }> = {
  start: { callback: "onStart", stages: ["photo"] },
  cancel: { callback: "onCancel", stages: working },
  retry: { callback: "onRetry", stages: ["error"] },
  restart: { callback: "onStartOver", stages: ["ready", "error"] },
  download: { callback: "onDownload", stages: ["ready"] },
}

const during: Record<ModelScanStage, string> = {
  photo: "before a scan starts",
  detecting: "while the scan runs",
  building: "while the scan runs",
  refining: "while the scan runs",
  ready: "once the model is ready",
  error: "after an error",
}

const clamp = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))

// Progress is read at most every tenth, and no sooner than this after the last reading.
const progressStep = 10
const progressInterval = 2000

const sweepFrames: Keyframe[] = [
  { transform: "translateY(-100%)", opacity: 0 },
  { opacity: 1, offset: 0.12 },
  { opacity: 1, offset: 0.88 },
  { transform: "translateY(294%)", opacity: 0 },
]

const modelScan = definePrimitive({
  name: "model-scan",
  options: {
    stage: "string",
    progress: "number",
    onStart: "callback",
    onCancel: "callback",
    onRetry: "callback",
    onStartOver: "callback",
    onDownload: "callback",
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
    // An agent's call that can't run throws with why; a person's press returns false.
    const run = (action: ModelScanAction, event?: Event) => {
      const reason: ModelScanActionReason = event ? "trigger-press" : "imperative"
      const call = { reason, event }
      const { stage } = store.get()
      const { callback, stages } = actions[action]
      if (!stages.includes(stage)) return unavailable(action, `isn't available ${during[stage]}`, call)
      if (!context.options()[callback]) return unavailable(action, "isn't offered by the app", call)
      return settled(!dispatch(context, callback, null, call), action, call)
    }
    return {
      /** Starts a scan of the photo, through `onStart`. */
      start: (event?: Event) => run("start", event),
      /** Stops the scan while it runs, through `onCancel`. */
      cancel: (event?: Event) => run("cancel", event),
      /** Starts again after an error, through `onRetry`. */
      retry: (event?: Event) => run("retry", event),
      /** Back to the photo from the finished model or an error, through `onStartOver`. */
      restart: (event?: Event) => run("restart", event),
      /** Saves the finished model, through `onDownload`. */
      download: (event?: Event) => run("download", event),
      /** Whether `action` runs in the current stage with the callbacks given. */
      offers: (action: ModelScanAction) =>
        actions[action].stages.includes(store.get().stage) && Boolean(context.options()[actions[action].callback]),
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
      // Until the engine reports progress the beam sweeps down the photo again and again, and under reduced motion
      // it stays put. A component can't ship CSS keyframes, so the sweep is a Web Animation.
      bind: (el, part) => {
        const motion = el.ownerDocument.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)")
        let sweep: Animation | undefined
        const update = () => {
          const beam = el.querySelector<HTMLElement>("[data-beam]")
          const loop =
            part.store.get().progress === undefined && !motion?.matches && typeof beam?.animate === "function"
          if (loop && !sweep && beam) {
            sweep = beam.animate(sweepFrames, {
              duration: 2600,
              iterations: Infinity,
              easing: "cubic-bezier(0.45, 0, 0.55, 1)",
            })
          } else if (!loop && sweep) {
            sweep.cancel()
            sweep = undefined
          }
        }
        update()
        motion?.addEventListener("change", update)
        const unsubscribe = part.store.subscribe(update)
        return () => {
          unsubscribe()
          motion?.removeEventListener("change", update)
          sweep?.cancel()
        }
      },
    }),
    points: slot<{ handedOff?: boolean }>({
      props: { handedOff: "boolean" },
      present: (state, part) => state.stage === "detecting" || (state.stage === "building" && !part.props.handedOff),
      attrs: () => ({ "aria-hidden": "true" }),
    }),
  }),
  agent: { actions: ["start", "cancel", "retry", "restart", "download"] },
})

export { modelScan }
export type { ModelScanAction, ModelScanActionReason, ModelScanAnnouncements, ModelScanOptions, ModelScanStage }
