import {
  announce,
  createChange,
  css,
  definePrimitive,
  dispatch,
  prepareAnnouncements,
  type ChangeDetails,
} from "@ui-sdk/core"

import { settled, unavailable } from "@/lib/action-refusal"
import {
  clampBox,
  clampFraction as clamp,
  mapRegionBox,
  type ImageScanBox,
  type ImageScanFit,
  type ImageScanSize,
} from "@/lib/image-scan-geometry"
import { isElementOf } from "@/lib/narrow"

type ImageScanStatus = "uploaded" | "scanning" | "result" | "error"

type ImageScanRegionItem = { value: string; label: string }

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
  /** Width over height, when known before the image loads. */
  ratio?: number
  /** The frame's width over height; the image's own ratio by default. */
  aspectRatio?: number
  fit?: ImageScanFit
  announcements?: ImageScanAnnouncements
}

const percentOf = (value: number) => `${String(Math.round(value * 10_000) / 100)}%`

const announcedProgressStepPercent = 10
const minMsBetweenProgressAnnouncements = 2000

const topOffsetWithoutRoomForLabelAbove = 0.12

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
    const run = (name: "onCancel" | "onRetry" | "onScan", when: ImageScanStatus, event?: Event) => {
      const action = name.slice(2).toLowerCase()
      const call = { reason: event ? "trigger-press" : "imperative", event } as const
      const { status } = context.store.get()
      if (status !== when) return unavailable(action, `works only ${whenWords[when]} (status: ${status})`, call)
      if (!context.options()[name]) return unavailable(action, `isn't offered: there is no ${name}`, call)
      return settled(!dispatch(context, name, null, call), action, call)
    }
    const api = {
      cancel: (event?: Event) => run("onCancel", "scanning", event),
      retry: (event?: Event) => run("onRetry", "error", event),
      scan: (event?: Event) => run("onScan", "uploaded", event),
      /** Takes an id or label; `null` clears the selection. */
      selectRegion(valueOrLabel: string | null, event?: Event) {
        const { regions, status } = context.store.get()
        const call = { reason: event ? "item-press" : "imperative", event } as const
        if (status !== "result")
          return unavailable("selectRegion", `works only in the result (status: ${status})`, call)
        const match =
          valueOrLabel === null
            ? null
            : regions.find((item) => item.value === valueOrLabel || item.label === valueOrLabel)?.value
        if (match === undefined) {
          const names = regions.map((item) => item.label).join(", ")
          throw new Error(`No region "${valueOrLabel ?? ""}". Its regions: ${names || "none"}.`)
        }
        return settled(change("selectedRegion", match, call), "selectRegion", call)
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
          const step = Math.floor(percent / announcedProgressStepPercent)
          const now = Date.now()
          if (step === lastStep || (now - lastTime < minMsBetweenProgressAnnouncements && percent < 100)) return
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
        if (!isElementOf(el, "HTMLImageElement")) return
        const image = el
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
          "data-edge": box.y < topOffsetWithoutRoomForLabelAbove ? "top" : undefined,
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
