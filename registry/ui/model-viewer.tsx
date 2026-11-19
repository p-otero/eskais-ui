"use client"

import { createParts, usePart, usePrimitive, type PartProps } from "@ui-sdk/react/primitive"
import { lazy, Suspense, useId, useMemo, type ReactNode } from "react"
import { CircleAlertIcon, PlayIcon, RotateCcwIcon, ZoomInIcon, ZoomOutIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { modelViewerLabels, type ModelViewerLabels } from "@/components/ui/model-viewer-labels"
import {
  clampNumber,
  modelViewerViews,
  type ModelViewerBounds,
  type ModelViewerFraming,
  type ModelViewerView,
} from "@/components/ui/model-viewer-math"
import {
  modelViewer,
  type ModelViewerControlsState,
  type ModelViewerHandle,
  type ModelViewerOptions,
  type ModelViewerState,
} from "@/components/ui/model-viewer-primitive"
import type { ModelViewerMaterial } from "@/components/ui/model-viewer-rig"
import { NativeSelect } from "@/components/ui/native-select"
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@/components/ui/segmented-control"
import { Toggle } from "@/components/ui/toggle"
import type { ModelViewerLoadInfo, ModelViewerSource } from "@/components/ui/use-model-viewer-scene"
import { cn, cnState } from "@/lib/utils"

const {
  Stage: ModelViewerStage,
  Poster: ModelViewerPoster,
  Canvas: ModelViewerCanvas,
  Message: ModelViewerMessage,
  Controls: ModelViewerControls,
} = createParts(modelViewer, {
  stage: "div",
  poster: "div",
  canvas: "div",
  message: "p",
  controls: "div",
})

const loadScene = () => import("@/components/ui/model-viewer-scene")

const ModelViewerScene = lazy(() => loadScene().then((module) => ({ default: module.ModelViewerScene })))

/** Starts loading the three.js scene before a viewer needs it, like on hover over a link to a page with one. */
function preloadModelViewer() {
  return loadScene().then(() => undefined)
}

type ModelViewerProps = Omit<PartProps<"div">, "children" | "onLoad" | "onError"> &
  Pick<
    ModelViewerOptions,
    | "view"
    | "defaultView"
    | "onViewChange"
    | "clip"
    | "defaultClip"
    | "onClipChange"
    | "playing"
    | "defaultPlaying"
    | "onPlayingChange"
  > & {
    /** The glTF or GLB: a URL, its bytes, or a loaded scene. Leave it out until there is one. */
    model?: ModelViewerSource
    /** Describes the model, and names the stage. Required: the stage is an image to assistive tech. */
    alt: string
    /** An image of the model, shown until it has loaded and wherever WebGL isn't available. */
    poster?: string
    /** A visible text alternative under the stage, which the stage points at. */
    summary?: ReactNode
    /** The stage's width over its height. */
    aspectRatio?: number
    /** What the camera fits: the whole model, or a sphere of it in its own units, like a face. */
    framing?: ModelViewerFraming
    /** Repeats the clip; off plays it once and holds its last pose. On by default. */
    loop?: boolean
    /** The clip's speed, 1 by default. */
    speed?: number
    /** Morph target weights by name, from 0 to 1, eased on the GPU side of the render loop, not in React. */
    weights?: Readonly<Record<string, number>>
    material?: ModelViewerMaterial
    /** `surface` draws the stage's own background; `transparent` shows what's behind it. */
    background?: "surface" | "transparent"
    /** Turns the model slowly while nobody drags it: true for 20° a second, or degrees a second. Never under reduced motion. */
    autoRotate?: boolean | number
    /** The controls under the stage and drag, wheel, pinch and keys on it. On by default. */
    controls?: boolean
    /** Loads the scene once the stage nears the viewport; false holds it back. */
    load?: boolean
    /** Content over the canvas, inside the stage. */
    overlay?: ReactNode
    /** three.js content inside the canvas, from a module of your own; it reads the model from `ModelViewerSceneContext`. */
    sceneChildren?: ReactNode
    onLoad?: (info: ModelViewerLoadInfo) => void
    onError?: (error: Error) => void
    /** What went wrong, shown and read at once when loading fails; `labels.error` by default. */
    error?: string
    labels?: Partial<ModelViewerLabels>
  }

const defaultSpin = 20

/**
 * A 3D model (glTF or GLB) in a stage that turns with drag, wheel, pinch and keys, with views, zoom, reset and its
 * animation clips. The three.js scene is a separate chunk, loaded when the stage nears the viewport and only with
 * WebGL; until then, and without WebGL, the poster stands in. It draws on demand and stops off screen.
 */
function ModelViewer({
  model,
  alt,
  poster,
  summary,
  aspectRatio = 1,
  view,
  defaultView,
  onViewChange,
  framing = "full",
  clip,
  defaultClip,
  onClipChange,
  playing,
  defaultPlaying,
  onPlayingChange,
  loop = true,
  speed = 1,
  weights,
  material = "standard",
  background = "surface",
  autoRotate = false,
  controls = true,
  load = true,
  overlay,
  sceneChildren,
  onLoad,
  onError,
  error,
  labels: ownLabels,
  className,
  style,
  ...props
}: ModelViewerProps) {
  const labels = { ...modelViewerLabels, ...ownLabels, view: { ...modelViewerLabels.view, ...ownLabels?.view } }
  const id = useId()
  const hintId = `${id}-hint`
  const summaryId = `${id}-summary`
  const viewer = usePrimitive(modelViewer, {
    view,
    defaultView,
    onViewChange,
    clip,
    defaultClip,
    onClipChange,
    playing,
    defaultPlaying,
    onPlayingChange,
    interactive: controls,
    load,
    errorMessage: error ?? labels.error,
  })
  const handle: ModelViewerHandle = useMemo(
    () => ({
      get: () => viewer.instance.get() as ModelViewerState,
      subscribe: (listener) => viewer.instance.subscribe(listener),
      api: viewer.api,
    }),
    [viewer.instance, viewer.api],
  )
  const spin = autoRotate === true ? defaultSpin : autoRotate === false ? 0 : autoRotate
  const ratio = clampNumber(aspectRatio, 0.25, 4)

  const content = (
    <>
      <ModelViewerStage
        label={alt}
        describedBy={cn(controls && hintId, summary ? summaryId : undefined) || undefined}
        className={cnState(
          "relative isolate aspect-(--model-viewer-ratio) w-full touch-pan-y overflow-hidden rounded-surface border outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-interactive:cursor-grab data-interactive:active:cursor-grabbing",
          background === "surface" ? "bg-muted" : "bg-transparent",
        )}
      >
        <ModelViewerPoster className="pointer-events-none absolute inset-0 transition-opacity duration-panel ease-standard data-[status=ready]:opacity-0">
          {poster ? (
            <img
              src={poster}
              alt=""
              draggable={false}
              className="aspect-(--model-viewer-ratio) size-full object-contain"
            />
          ) : (
            <span className="absolute inset-0 animate-pulse bg-skeleton in-data-[status=error]:hidden in-data-[status=unsupported]:hidden" />
          )}
        </ModelViewerPoster>
        <ModelViewerCanvas className="absolute inset-0">
          <Suspense fallback={null}>
            <ModelViewerScene
              handle={handle}
              model={model}
              framing={framing}
              weights={weights}
              material={material}
              loop={loop}
              speed={speed}
              autoRotate={spin}
              onLoad={onLoad}
              onError={onError}
            >
              {sceneChildren}
            </ModelViewerScene>
          </Suspense>
        </ModelViewerCanvas>
        {overlay}
        <ModelViewerMessage className="absolute inset-x-0 bottom-0 m-0 flex items-center gap-inline bg-background/(--glass-opacity) px-inset-item py-inset-item text-body-sm text-foreground">
          {(state) => (
            <>
              <CircleAlertIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0">{state.status === "error" ? (error ?? labels.error) : labels.unsupported}</span>
            </>
          )}
        </ModelViewerMessage>
        {controls ? (
          <span id={hintId} hidden>
            {labels.keyboard}
          </span>
        ) : null}
      </ModelViewerStage>
      <ModelViewerControls label={labels.controls} className="flex flex-wrap items-center gap-items">
        {(state) => <ModelViewerControlBar handle={handle} state={state} labels={labels} />}
      </ModelViewerControls>
      {summary ? (
        <p id={summaryId} className="text-body-sm text-muted-foreground">
          {summary}
        </p>
      ) : null}
    </>
  )

  return usePart(
    viewer,
    "root",
    {},
    {
      "aria-label": alt,
      ...props,
      style: { ...style, "--model-viewer-ratio": String(ratio) } as PartProps<"div">["style"],
      className: cnState("flex w-full min-w-0 flex-col gap-items", className),
      children: content,
    },
    "div",
  )
}

function ModelViewerControlBar({
  handle,
  state,
  labels,
}: {
  handle: ModelViewerHandle
  state: ModelViewerControlsState
  labels: ModelViewerLabels
}) {
  const ready = state.status === "ready"
  const { api } = handle
  return (
    <>
      <SegmentedControl<ModelViewerView>
        aria-label={labels.views}
        value={state.view}
        disabled={!ready}
        onValueChange={(next, details) => {
          if (next) api.setView(next, details.event)
          else details.cancel()
        }}
        className="max-w-full"
      >
        <SegmentedControlIndicator />
        {modelViewerViews.map((name) => (
          <SegmentedControlItem key={name} value={name} className="h-control-sm px-inset-item">
            {labels.view[name]}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
      <div className="flex items-center gap-inline">
        <Button
          variant="ghost"
          size="icon"
          aria-label={labels.zoomOut}
          disabled={!ready}
          onClick={(event) => api.zoom(-1, event.nativeEvent)}
        >
          <ZoomOutIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={labels.zoomIn}
          disabled={!ready}
          onClick={(event) => api.zoom(1, event.nativeEvent)}
        >
          <ZoomInIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={labels.reset}
          disabled={!ready}
          onClick={(event) => api.reset(event.nativeEvent)}
        >
          <RotateCcwIcon />
        </Button>
      </div>
      {state.clips.length > 0 ? (
        <div className="flex min-w-0 items-center gap-inline">
          <Toggle
            variant="outline"
            size="icon"
            aria-label={labels.play}
            pressed={state.playing}
            onPressedChange={(pressed, details) => {
              if (pressed) api.play(details.event)
              else api.pause(details.event)
            }}
          >
            <PlayIcon />
          </Toggle>
          {state.clips.length > 1 ? (
            <NativeSelect
              aria-label={labels.clip}
              options={state.clips.map((name) => ({ value: name, label: name }))}
              value={state.clip}
              onValueChange={(next, details) => {
                if (next) api.selectClip(next, details.event)
              }}
              className="h-control-sm min-w-0"
            />
          ) : null}
        </div>
      ) : null}
    </>
  )
}

export { ModelViewer, preloadModelViewer }
export type {
  ModelViewerBounds,
  ModelViewerFraming,
  ModelViewerLabels,
  ModelViewerProps,
  ModelViewerSource,
  ModelViewerView,
}
