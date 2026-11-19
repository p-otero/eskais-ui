import {
  announce,
  createChange,
  css,
  definePrimitive,
  dispatch,
  prepareAnnouncements,
  type ChangeDetails,
} from "@ui-sdk/core"

type ImageScanStatus = "uploaded" | "scanning" | "result" | "error"

type ImageScanFit = "contain" | "cover"

/** A rectangle on the image, each value a fraction of its width or height, from its top left corner. */
type ImageScanBox = { x: number; y: number; width: number; height: number }

type ImageScanRegionItem = { value: string; label: string }

/** Why a region was selected: a press on its box or its legend row, or a call (an agent, a controller). */
type ImageScanSelectReason = "item-press" | "imperative"

type ImageScanActionReason = "trigger-press" | "imperative"

type ImageScanAnnouncements = {
  scanning: string
  /** `percent` is a whole number from 0 to 100. */
  progress: (percent: number) => string
  result: (count: number) => string
  error: string
}

type ImageScanOptions = {
  status?: ImageScanStatus
  /** From 0 to 1; undefined while the scan can't tell how far it is. */
  progress?: number
  regions?: readonly ImageScanRegionItem[]
  selectedRegion?: string | null
  defaultSelectedRegion?: string | null
  onSelectedRegionChange?: (region: string | null, details: ChangeDetails<ImageScanSelectReason>) => void
  onCancel?: (value: null, details: ChangeDetails<ImageScanActionReason>) => void
  onRetry?: (value: null, details: ChangeDetails<ImageScanActionReason>) => void
  onScan?: (value: null, details: ChangeDetails<ImageScanActionReason>) => void
  /** The image's width over its height, when known before it loads. */
  ratio?: number
  /** The frame's width over its height; the image's own ratio by default. */
  aspectRatio?: number
  fit?: ImageScanFit
  announcements?: ImageScanAnnouncements
}

type ImageScanSize = { width: number; height: number }

/**
 * Where a region's box lands in the frame, in the frame's pixels, for an image drawn with `object-fit` and a centred
 * `object-position`. With `cover` the result can reach past the frame, which clips it.
 */
function mapRegionBox(
  box: ImageScanBox,
  { fit, image, frame }: { fit: ImageScanFit; image: ImageScanSize; frame: ImageScanSize },
): ImageScanBox {
  const scaleX = frame.width / image.width
  const scaleY = frame.height / image.height
  const scale = fit === "contain" ? Math.min(scaleX, scaleY) : Math.max(scaleX, scaleY)
  const width = image.width * scale
  const height = image.height * scale
  const left = (frame.width - width) / 2
  const top = (frame.height - height) / 2
  return { x: left + box.x * width, y: top + box.y * height, width: box.width * width, height: box.height * height }
}

const clamp = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))

/** Keeps a box inside the image, so a detector's rounding never draws a box past its edge. */
function clampBox(box: ImageScanBox): ImageScanBox {
  const x = clamp(box.x)
  const y = clamp(box.y)
  return { x, y, width: Math.min(clamp(box.width), 1 - x), height: Math.min(clamp(box.height), 1 - y) }
}

const percentOf = (value: number) => `${String(Math.round(value * 10_000) / 100)}%`

// Progress is read at most every tenth, and no sooner than this after the last reading, so a screen reader isn't
// talked over by a fast scan.
const progressStep = 10
const progressInterval = 2000

// A box this close to the top has no room for its label above it, so the label sits inside.
const topEdge = 0.12

const defaultRatio = 4 / 3

const whenWords: Record<ImageScanStatus, string> = {
  uploaded: "before a scan",
  scanning: "while scanning",
  result: "in the result",
  error: "after an error",
}

const imageScan = definePrimitive({
  name: "image-scan",
  options: {
    status: "string",
    progress: "number",
    regions: "value",
    selectedRegion: "value",
    defaultSelectedRegion: "value",
    onSelectedRegionChange: "callback",
    onCancel: "callback",
    onRetry: "callback",
    onScan: "callback",
    ratio: "number",
    aspectRatio: "number",
    fit: "string",
    announcements: "value",
  },
  controlled: ["selectedRegion", "status"],
  state: (options: ImageScanOptions) => ({
    status: options.status ?? "uploaded",
    progress: options.progress,
    regions: options.regions ?? [],
    selectedRegion: options.selectedRegion ?? options.defaultSelectedRegion ?? null,
    highlighted: null as string | null,
    measuredRatio: undefined as number | undefined,
    ratio: options.ratio,
    aspectRatio: options.aspectRatio,
    fit: options.fit ?? "contain",
  }),
  sync: (options) => ({
    status: options.status ?? "uploaded",
    progress: options.progress,
    regions: options.regions ?? [],
    ratio: options.ratio,
    aspectRatio: options.aspectRatio,
    fit: options.fit ?? "contain",
    ...(options.selectedRegion === undefined ? {} : { selectedRegion: options.selectedRegion }),
  }),
  api: (context) => {
    const change = createChange(context)
    // A call that can't apply throws, so an agent's step fails with why instead of reporting success.
    const run = (name: "onCancel" | "onRetry" | "onScan", when: ImageScanStatus, event?: Event) => {
      const { status } = context.store.get()
      if (status !== when) throw new Error(`${name.slice(2)} works only ${whenWords[when]} (status: ${status}).`)
      if (!context.options()[name]) throw new Error(`${name.slice(2)} isn't offered: there is no ${name}.`)
      return !dispatch(context, name, null, { reason: event ? "trigger-press" : "imperative", event })
    }
    const api = {
      /** Stops a running scan through `onCancel`. */
      cancel: (event?: Event) => run("onCancel", "scanning", event),
      /** Starts again after an error through `onRetry`. */
      retry: (event?: Event) => run("onRetry", "error", event),
      /** Starts a scan of the uploaded image through `onScan`. */
      scan: (event?: Event) => run("onScan", "uploaded", event),
      /** Selects a detected region by its id or label; `null` clears the selection. */
      selectRegion(region: string | null, event?: Event) {
        const { regions, status } = context.store.get()
        if (status !== "result") throw new Error(`Regions can be selected only in the result (status: ${status}).`)
        const match =
          region === null ? null : regions.find((item) => item.value === region || item.label === region)?.value
        if (match === undefined) {
          const names = regions.map((item) => item.label).join(", ")
          throw new Error(`No region "${region ?? ""}". Its regions: ${names || "none"}.`)
        }
        return change("selectedRegion", match, { reason: event ? "item-press" : "imperative", event })
      },
      /** A second press on the selected region clears the selection. */
      toggleRegion(region: string, event?: Event) {
        return api.selectRegion(context.store.get().selectedRegion === region ? null : region, event)
      },
      highlight(region: string | null) {
        if (context.store.get().highlighted !== region) context.store.set({ highlighted: region })
      },
      announcements: () => context.options().announcements,
      regionItems: () => context.store.get().regions.map(({ value, label }) => ({ value, label })),
      measured(ratio: number) {
        if (Number.isFinite(ratio) && ratio > 0) context.store.set({ measuredRatio: ratio })
      },
    }
    return api
  },
  slots: (slot) => ({
    root: slot({
      role: "group",
      attrs: (state) => {
        const ratio = state.ratio ?? state.measuredRatio ?? state.aspectRatio ?? defaultRatio
        return {
          "data-status": state.status,
          "data-fit": state.fit,
          "aria-busy": state.status === "scanning" ? "true" : undefined,
          style: css({
            "--image-scan-ratio": String(ratio),
            "--image-scan-frame-ratio": String(state.aspectRatio ?? ratio),
            "--image-scan-progress": state.progress === undefined ? undefined : String(clamp(state.progress)),
          }),
        }
      },
      bind: (el, part) => {
        const doc = el.ownerDocument
        prepareAnnouncements(doc)
        let { status } = part.store.get()
        let lastStep = -1
        let lastTime = -Infinity
        return part.store.subscribe(() => {
          const state = part.store.get()
          const messages = part.api.announcements()
          if (state.status !== status) {
            status = state.status
            lastStep = -1
            lastTime = -Infinity
            if (!messages) return
            if (status === "scanning") announce(messages.scanning, { doc })
            else if (status === "result") announce(messages.result(state.regions.length), { doc })
            else if (status === "error") announce(messages.error, { doc, priority: "assertive" })
            return
          }
          if (status !== "scanning" || state.progress === undefined || !messages) return
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
    frame: slot({
      attrs: (state) => ({ "data-status": state.status }),
    }),
    image: slot({
      attrs: (state) => ({ "data-fit": state.fit, "data-status": state.status }),
      bind: (el, part) => {
        const image = el as HTMLImageElement
        const read = () => {
          if (image.naturalWidth > 0 && image.naturalHeight > 0)
            part.api.measured(image.naturalWidth / image.naturalHeight)
        }
        read()
        image.addEventListener("load", read)
        return () => image.removeEventListener("load", read)
      },
    }),
    layer: slot({
      attrs: (state) => ({ "data-fit": state.fit, "data-status": state.status }),
    }),
    effect: slot({
      present: (state) => state.status === "scanning",
      attrs: (state) => ({
        "aria-hidden": "true",
        "data-determinate": state.progress === undefined ? undefined : "",
      }),
    }),
    regions: slot<{ label?: string }>({
      props: { label: "string" },
      present: (state) => state.status === "result" && state.regions.length > 0,
      attrs: (_state, part) => ({ "aria-label": part.props.label }),
    }),
    region: slot<{ value: string; box: ImageScanBox; tone?: string; index?: number }>({
      props: { value: "string", box: "value", tone: "string", index: "number" },
      role: "button",
      focus: "native",
      press: ({ api, key }, event) => api.toggleRegion(key, event),
      attrs: (state, part) => {
        const box = clampBox(part.props.box)
        return {
          type: "button",
          "aria-pressed": String(state.selectedRegion === part.key),
          "data-selected": state.selectedRegion === part.key ? "" : undefined,
          "data-highlighted": state.highlighted === part.key ? "" : undefined,
          "data-tone": part.props.tone,
          "data-edge": box.y < topEdge ? "top" : undefined,
          "data-align": box.x > 0.4 && box.x + box.width > 0.6 ? "end" : undefined,
          style: css({
            left: percentOf(box.x),
            top: percentOf(box.y),
            width: percentOf(box.width),
            height: percentOf(box.height),
            "--image-scan-region-index": String(part.props.index ?? 0),
          }),
        }
      },
      on: {
        pointerenter: (_event, { api, key }) => api.highlight(key),
        pointerleave: (_event, { api }) => api.highlight(null),
        focus: (_event, { api, key }) => api.highlight(key),
        blur: (_event, { api }) => api.highlight(null),
      },
    }),
    legend: slot({
      present: (state) => state.status === "result" && state.regions.length > 0,
      attrs: () => ({ "aria-hidden": "true" }),
    }),
    "legend-item": slot<{ value: string; tone?: string }>({
      props: { value: "string", tone: "string" },
      attrs: (state, part) => ({
        "data-selected": state.selectedRegion === part.key ? "" : undefined,
        "data-highlighted": state.highlighted === part.key ? "" : undefined,
        "data-tone": part.props.tone,
      }),
      on: {
        pointerenter: (_event, { api, key }) => api.highlight(key),
        pointerleave: (_event, { api }) => api.highlight(null),
        click: (event, { api, key }) => api.toggleRegion(key, event),
      },
    }),
  }),
  agent: { actions: ["cancel", "retry", "scan", "selectRegion"], items: (api) => api.regionItems() },
})

export { clampBox, imageScan, mapRegionBox }
export type {
  ImageScanActionReason,
  ImageScanAnnouncements,
  ImageScanBox,
  ImageScanFit,
  ImageScanOptions,
  ImageScanRegionItem,
  ImageScanSelectReason,
  ImageScanSize,
  ImageScanStatus,
}
