import {
  announce,
  createChange,
  definePrimitive,
  prepareAnnouncements,
  type ChangeDetails,
  type TypesOf,
} from "@ui-sdk/core"

import {
  clampPitch,
  clampZoom,
  modelViewerViews,
  nearestAngle,
  viewAngles,
  wrapDegrees,
  type ModelViewerView,
} from "@/components/ui/model-viewer-math"

/** `unsupported`: the browser has no WebGL, so the poster and a message stand in. */
type ModelViewerStatus = "idle" | "loading" | "ready" | "error" | "unsupported"

/** A press on a control, a choice in the clip list, a key on the stage, a drag or pinch, or a call (an agent, a controller). */
type ModelViewerChangeReason = "trigger-press" | "input-change" | "keyboard" | "drag" | "imperative"

type ModelViewerMotion = "tween" | "jump"

type ModelViewerOptions = {
  view?: ModelViewerView | null
  defaultView?: ModelViewerView
  onViewChange?: (view: ModelViewerView | null, details: ChangeDetails<ModelViewerChangeReason>) => void
  clip?: string | null
  defaultClip?: string | null
  onClipChange?: (clip: string | null, details: ChangeDetails<ModelViewerChangeReason>) => void
  /** Leave it out, or null, to play once loaded, except under reduced motion. */
  playing?: boolean | null
  defaultPlaying?: boolean
  onPlayingChange?: (playing: boolean | null, details: ChangeDetails<ModelViewerChangeReason>) => void
  /** Drag, pinch, wheel and keys move the camera. */
  interactive?: boolean
  /** Loads the scene once the stage nears the viewport; false holds it back. */
  load?: boolean
  errorMessage?: string
}

// Rotation per arrow press and per CSS pixel dragged, in degrees, and the zoom factor per step.
const keyStep = 15
const dragStep = 0.4
const zoomStep = 1.25

let webgl: boolean | undefined

/** Whether this browser can draw WebGL, asked once per page. */
function supportsWebGL(doc: Document) {
  if (webgl !== undefined) return webgl
  const canvas = doc.createElement("canvas")
  const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl")
  webgl = context !== null
  context?.getExtension("WEBGL_lose_context")?.loseContext()
  return webgl
}

type ModelViewerControlsState = {
  status: ModelViewerStatus
  view: ModelViewerView | null
  clips: readonly string[]
  /** The clip that plays: the chosen one, or the model's first. */
  clip: string | null
  playing: boolean
}

const reasonOf = (event: Event | undefined, fallback: ModelViewerChangeReason): ModelViewerChangeReason =>
  event ? fallback : "imperative"

const zoomKeys: Record<string, number> = { "+": 1, "=": 1, "-": -1, _: -1 }

const modelViewer = definePrimitive({
  name: "model-viewer",
  options: {
    view: "value",
    defaultView: "string",
    onViewChange: "callback",
    clip: "value",
    defaultClip: "value",
    onClipChange: "callback",
    playing: "boolean",
    defaultPlaying: "boolean",
    onPlayingChange: "callback",
    interactive: "boolean",
    load: "boolean",
    errorMessage: "string",
  },
  controlled: ["view", "clip", "playing"],
  live: ["yaw", "pitch", "zoom", "motion", "turn", "dragging"],
  state: (options: ModelViewerOptions) => {
    const view = options.view === undefined ? (options.defaultView ?? "front") : options.view
    const angles = viewAngles[view ?? "front"]
    return {
      view,
      yaw: angles.yaw,
      pitch: angles.pitch,
      zoom: 1,
      motion: "jump" as ModelViewerMotion,
      // Counts camera moves, so the scene can tell a new one from a repeat of the same angles.
      turn: 0,
      dragging: false,
      clip: options.clip ?? options.defaultClip ?? null,
      clips: [] as readonly string[],
      // null until someone chooses: the scene then plays unless motion is reduced.
      playing: (options.playing ?? options.defaultPlaying ?? null) as boolean | null,
      status: "idle" as ModelViewerStatus,
      reducedMotion: false,
      inView: false,
      pageHidden: false,
      seen: false,
      interactive: options.interactive ?? true,
      load: options.load ?? true,
    }
  },
  sync: (options) => ({
    interactive: options.interactive ?? true,
    load: options.load ?? true,
    ...(options.view === undefined ? {} : { view: options.view }),
    ...(options.clip === undefined ? {} : { clip: options.clip }),
    ...(options.playing === undefined ? {} : { playing: options.playing }),
  }),
  api: (context) => {
    const { store } = context
    const change = createChange(context)

    const move = (camera: { yaw?: number; pitch?: number; zoom?: number }, motion: ModelViewerMotion) => {
      const state = store.get()
      store.set({
        yaw: camera.yaw ?? state.yaw,
        pitch: clampPitch(camera.pitch ?? state.pitch),
        zoom: clampZoom(camera.zoom ?? state.zoom),
        motion: state.reducedMotion ? "jump" : motion,
        turn: state.turn + 1,
      })
    }
    const aim = (view: ModelViewerView, motion: ModelViewerMotion = "tween") => {
      const angles = viewAngles[view]
      const zoom = motion === "jump" ? { zoom: 1 } : {}
      move({ yaw: nearestAngle(store.get().yaw, angles.yaw), pitch: angles.pitch, ...zoom }, motion)
    }

    // A view set by a press, a prop or an agent turns the camera to it; free rotation clears the view.
    let aimed = store.get().view
    const unsubscribe = store.subscribe(() => {
      const { view } = store.get()
      if (view === aimed) return
      aimed = view
      if (view) aim(view)
    })
    context.onDestroy(unsubscribe)

    const loadedClips = (action: string) => {
      const { clips, status } = store.get()
      if (status !== "ready") throw new Error(`${action} works once the model has loaded (status: ${status}).`)
      if (clips.length === 0) throw new Error(`${action} needs an animation clip, and this model has none.`)
      return clips
    }
    const ready = (action: string) => {
      const { status } = store.get()
      if (status !== "ready") throw new Error(`${action} works once the model has loaded (status: ${status}).`)
    }
    const freeView = (reason: ModelViewerChangeReason, event?: Event) => {
      if (store.get().view !== null) change("view", null, { reason, event })
    }

    const api = {
      /** Turns the camera around the model by degrees: positive yaw turns the model right, positive pitch looks down on it. */
      rotate(yaw: number, pitch = 0, event?: Event) {
        ready("rotate")
        const state = store.get()
        freeView(reasonOf(event, "keyboard"), event)
        move({ yaw: state.yaw - yaw, pitch: state.pitch + pitch }, event?.type === "pointermove" ? "jump" : "tween")
        return true
      },
      /** Zooms in by steps (negative steps zoom out), each a factor of 1.25. */
      zoom(steps: number, event?: Event) {
        ready("zoom")
        move({ zoom: store.get().zoom * zoomStep ** steps }, event?.type === "keydown" ? "tween" : "jump")
        return true
      },
      /** Back to the first view and zoom. */
      reset(event?: Event) {
        ready("reset")
        const view = context.options().defaultView ?? "front"
        change("view", view, { reason: reasonOf(event, "trigger-press"), event })
        const angles = viewAngles[view]
        move({ yaw: nearestAngle(store.get().yaw, angles.yaw), pitch: angles.pitch, zoom: 1 }, "tween")
        return true
      },
      /** Turns to a named view: front, three-quarter, side or back. */
      setView(view: ModelViewerView, event?: Event) {
        if (!modelViewerViews.includes(view)) {
          throw new Error(`No view "${String(view)}". Views: ${modelViewerViews.join(", ")}.`)
        }
        return change("view", view, { reason: reasonOf(event, "trigger-press"), event })
      },
      play(event?: Event) {
        loadedClips("play")
        return change("playing", true, { reason: reasonOf(event, "trigger-press"), event })
      },
      pause(event?: Event) {
        loadedClips("pause")
        return change("playing", false, { reason: reasonOf(event, "trigger-press"), event })
      },
      /** Chooses an animation clip by name; it plays if clips are playing. */
      selectClip(clip: string, event?: Event) {
        const clips = loadedClips("selectClip")
        const match =
          clips.find((name) => name === clip) ?? clips.find((name) => name.toLowerCase() === clip.toLowerCase())
        if (match === undefined) throw new Error(`No clip "${clip}". Clips: ${clips.join(", ")}.`)
        const reason = reasonOf(event, event?.type === "change" ? "input-change" : "trigger-press")
        return change("clip", match, { reason, event })
      },
      /** Whether the clip plays now: the choice made, or by default unless motion is reduced. */
      isPlaying: () => {
        const { playing, reducedMotion } = store.get()
        return playing ?? !reducedMotion
      },
      /** The clip that plays: the chosen one, or the model's first. */
      currentClip: () => {
        const { clip, clips } = store.get()
        return clip !== null && clips.includes(clip) ? clip : (clips[0] ?? null)
      },
      errorMessage: () => context.options().errorMessage,
      clipItems: () => store.get().clips.map((name) => ({ value: name, label: name })),
      /** The scene is loading the model. */
      loading: () => store.set({ status: "loading" }),
      /** The scene has the model, with these clips. */
      loaded: (clips: readonly string[]) => store.set({ status: "ready", clips }),
      failed: () => store.set({ status: "error" }),
      /** A drag or pinch started or ended; auto-rotation waits while it lasts. */
      setDragging: (dragging: boolean) => store.set({ dragging }),
      /** Turns the camera without counting as a person's rotation, for auto-rotation. */
      spin: (degrees: number) => store.set({ yaw: wrapDegrees(store.get().yaw + degrees), motion: "jump" }),
      /** Turns the camera to a view's angles without changing the chosen view, for a scripted move; a jump also resets the zoom. */
      aim,
    }
    return api
  },
  slots: (slot) => ({
    root: slot({
      role: "group",
      attrs: (state) => ({
        "data-status": state.status,
        "aria-busy": state.status === "loading" ? "true" : undefined,
      }),
      bind: (el, part) => {
        const doc = el.ownerDocument
        const win = doc.defaultView
        prepareAnnouncements(doc)
        const motion = win?.matchMedia?.("(prefers-reduced-motion: reduce)")
        const readMotion = () => part.store.set({ reducedMotion: motion?.matches ?? false })
        const readHidden = () => part.store.set({ pageHidden: doc.visibilityState === "hidden" })
        readMotion()
        readHidden()
        if (!supportsWebGL(doc)) part.store.set({ status: "unsupported" })
        motion?.addEventListener("change", readMotion)
        doc.addEventListener("visibilitychange", readHidden)
        // Loads a little before the stage scrolls in, and stops drawing while it's out of view.
        const observer =
          typeof IntersectionObserver === "function"
            ? new IntersectionObserver(
                (entries) => {
                  const inView = entries.some((entry) => entry.isIntersecting)
                  part.store.set(inView ? { inView, seen: true } : { inView })
                },
                { rootMargin: "200px" },
              )
            : undefined
        if (observer) observer.observe(el)
        else part.store.set({ inView: true, seen: true })
        let status = part.store.get().status
        const unsubscribe = part.store.subscribe(() => {
          const state = part.store.get()
          if (state.status === status) return
          status = state.status
          const message = part.api.errorMessage()
          if (status === "error" && message) announce(message, { doc, priority: "assertive" })
        })
        return () => {
          unsubscribe()
          observer?.disconnect()
          motion?.removeEventListener("change", readMotion)
          doc.removeEventListener("visibilitychange", readHidden)
        }
      },
    }),
    stage: slot<{ label: string; describedBy?: string }>({
      props: { label: "string", describedBy: "string" },
      role: "img",
      attrs: (state, part) => ({
        "aria-label": part.props.label,
        "aria-describedby": part.props.describedBy,
        tabindex: state.interactive && state.status === "ready" ? "0" : undefined,
        "data-interactive": state.interactive && state.status === "ready" ? "" : undefined,
        "data-status": state.status,
      }),
      on: {
        keydown: (event, { api, store }) => {
          const { interactive, status } = store.get()
          const key = event as KeyboardEvent
          if (!interactive || status !== "ready" || key.altKey || key.ctrlKey || key.metaKey) return
          const turns: Record<string, [number, number]> = {
            ArrowLeft: [-keyStep, 0],
            ArrowRight: [keyStep, 0],
            ArrowUp: [0, -keyStep],
            ArrowDown: [0, keyStep],
          }
          const turn = turns[key.key]
          if (turn) api.rotate(turn[0], turn[1], event)
          else if (key.key in zoomKeys) api.zoom(zoomKeys[key.key] ?? 0, event)
          else if (key.key === "Home") api.reset(event)
          else return
          event.preventDefault()
        },
      },
      bind: (el, part) => {
        const pointers = new Map<number, { x: number; y: number }>()
        let spread = 0
        const distance = () => {
          const [a, b] = [...pointers.values()]
          return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0
        }
        const active = () => {
          const { interactive, status } = part.store.get()
          return interactive && status === "ready"
        }
        const down = (event: PointerEvent) => {
          if (!active() || (event.pointerType === "mouse" && event.button !== 0)) return
          el.setPointerCapture?.(event.pointerId)
          pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
          spread = distance()
          part.api.setDragging(true)
        }
        const moveTo = (event: PointerEvent) => {
          const last = pointers.get(event.pointerId)
          if (!last) return
          const dx = event.clientX - last.x
          const dy = event.clientY - last.y
          pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
          if (pointers.size === 1) {
            if (dx !== 0 || dy !== 0) part.api.rotate(dx * dragStep, dy * dragStep, event)
            return
          }
          const next = distance()
          if (spread > 0 && next > 0) part.api.zoom(Math.log(next / spread) / Math.log(zoomStep), event)
          spread = next
        }
        const up = (event: PointerEvent) => {
          if (!pointers.delete(event.pointerId)) return
          spread = distance()
          if (pointers.size === 0) part.api.setDragging(false)
        }
        const wheel = (event: WheelEvent) => {
          if (!active()) return
          event.preventDefault()
          part.api.zoom(-event.deltaY / 240, event)
        }
        el.addEventListener("pointerdown", down)
        el.addEventListener("pointermove", moveTo)
        el.addEventListener("pointerup", up)
        el.addEventListener("pointercancel", up)
        el.addEventListener("wheel", wheel, { passive: false })
        return () => {
          el.removeEventListener("pointerdown", down)
          el.removeEventListener("pointermove", moveTo)
          el.removeEventListener("pointerup", up)
          el.removeEventListener("pointercancel", up)
          el.removeEventListener("wheel", wheel)
        }
      },
    }),
    poster: slot({
      attrs: (state) => ({ "aria-hidden": "true", "data-status": state.status }),
    }),
    canvas: slot({
      present: (state) => state.status !== "unsupported" && state.load && state.seen,
      attrs: (state) => ({ "aria-hidden": "true", "data-status": state.status }),
    }),
    message: slot<{}, { status: ModelViewerStatus }>({
      state: (state) => ({ status: state.status }),
      present: (state) => state.status === "unsupported" || state.status === "error",
      attrs: (state) => ({ "data-status": state.status }),
    }),
    controls: slot<{ label?: string }, ModelViewerControlsState>({
      props: { label: "string" },
      role: "group",
      state: (state) => ({
        status: state.status,
        view: state.view,
        clips: state.clips,
        clip: state.clip !== null && state.clips.includes(state.clip) ? state.clip : (state.clips[0] ?? null),
        playing: state.playing ?? !state.reducedMotion,
      }),
      present: (state) => state.interactive && state.status !== "unsupported",
      attrs: (state, part) => ({
        "aria-label": part.props.label,
        "data-status": state.status,
      }),
    }),
  }),
  agent: {
    actions: ["rotate", "zoom", "reset", "setView", "play", "pause", "selectClip"],
    items: (api) => api.clipItems(),
  },
})

type ModelViewerState = TypesOf<typeof modelViewer>["state"]

/** The viewer's state and api, as the scene reads them each frame. */
type ModelViewerHandle = {
  get: () => ModelViewerState
  subscribe: (listener: () => void) => () => void
  api: TypesOf<typeof modelViewer>["api"]
}

export { modelViewer }
export type {
  ModelViewerHandle,
  ModelViewerState,
  ModelViewerChangeReason,
  ModelViewerControlsState,
  ModelViewerMotion,
  ModelViewerOptions,
  ModelViewerStatus,
}
