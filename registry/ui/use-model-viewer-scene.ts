import { useFrame, useThree } from "@react-three/fiber"
import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react"
import type { AnimationClip, Object3D, PerspectiveCamera } from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"

import type { ModelViewerExpressions, ModelViewerFraming, ModelViewerWeights } from "@/components/ui/model-viewer-math"
import type { ModelViewerHandle } from "@/components/ui/model-viewer-primitive"
import {
  createModelRig,
  type LoadedModel,
  type ModelRig,
  type ModelViewerMaterial,
  type RigInput,
} from "@/components/ui/model-viewer-rig"

/** A glTF or GLB: its URL, its bytes, or a scene loaded already (a GLTFLoader result works). */
type ModelViewerSource = string | ArrayBuffer | { scene: Object3D; animations?: readonly AnimationClip[] }

type ModelViewerLoadInfo = { clips: string[]; morphTargets: string[] }

// Bytes from another realm (a worker, an iframe) aren't instanceof this one's ArrayBuffer.
const isBytes = (source: unknown): source is ArrayBuffer =>
  source instanceof ArrayBuffer || Object.prototype.toString.call(source) === "[object ArrayBuffer]"

async function loadModel(source: ModelViewerSource): Promise<LoadedModel> {
  if (typeof source === "object" && !isBytes(source)) {
    return { scene: source.scene, animations: source.animations ?? [] }
  }
  const loader = new GLTFLoader()
  const gltf = typeof source === "string" ? await loader.loadAsync(source) : await loader.parseAsync(source, "")
  return { scene: gltf.scene, animations: gltf.animations }
}

const owns = (source: ModelViewerSource) => typeof source === "string" || isBytes(source)

/**
 * Loads the model and builds its rig; the viewer's status follows. A new source loads beside the shown one, takes
 * over its camera, weights and clip time, and replaces it at once when both look the same (`signature`), or fades in
 * over it (`leaving`) when they don't. A rig is disposed once nothing shows it.
 */
function useModelRig(
  source: ModelViewerSource | undefined,
  handle: ModelViewerHandle,
  onLoad?: (info: ModelViewerLoadInfo) => void,
  onError?: (error: Error) => void,
) {
  const [shown, setShown] = useState<{ rig: ModelRig; leaving: ModelRig | null } | null>(null)
  const newest = useRef<ModelRig | null>(null)
  const made = useRef(new Set<ModelRig>())
  const loadedEvent = useEffectEvent((rig: ModelRig) => {
    handle.api.loaded(rig.clipNames)
    onLoad?.({ clips: [...rig.clipNames], morphTargets: [...rig.morphNames] })
  })
  const failedEvent = useEffectEvent((error: unknown) => {
    handle.api.failed()
    onError?.(error instanceof Error ? error : new Error(String(error)))
  })
  useEffect(() => {
    if (source === undefined) return
    let cancelled = false
    // A replacement loads under the model on screen: the viewer stays ready.
    if (!newest.current) handle.api.loading()
    loadModel(source).then(
      (model) => {
        const rig = createModelRig(model, owns(source))
        if (cancelled) {
          rig.dispose()
          return
        }
        made.current.add(rig)
        const previous = newest.current
        newest.current = rig
        const same = previous?.signature === rig.signature
        if (previous) rig.inherit(previous)
        if (previous && !same) rig.setOpacity(0, "swap")
        setShown({ rig, leaving: previous && !same ? previous : null })
        loadedEvent(rig)
      },
      (error: unknown) => {
        if (!cancelled) failedEvent(error)
      },
    )
    return () => {
      cancelled = true
    }
  }, [source, handle])
  useEffect(() => {
    for (const rig of made.current) {
      if (rig === shown?.rig || rig === shown?.leaving) continue
      rig.dispose()
      made.current.delete(rig)
    }
  }, [shown])
  useEffect(() => {
    const rigs = made.current
    return () => {
      for (const rig of rigs) rig.dispose()
      rigs.clear()
    }
  }, [])
  const finishSwap = () => setShown((current) => (current?.leaving ? { rig: current.rig, leaving: null } : current))
  return { rig: shown?.rig ?? null, leaving: shown?.leaving ?? null, finishSwap }
}

/** "never" while the stage is out of view or the tab is hidden, so nothing draws; "demand" otherwise. */
function useSceneFrameloop(handle: ModelViewerHandle) {
  return useSyncExternalStore(
    handle.subscribe,
    () => {
      const state = handle.get()
      return state.inView && !state.pageHidden ? "demand" : "never"
    },
    () => "never" as const,
  )
}

type ModelFrameOptions = {
  handle: ModelViewerHandle
  rig: ModelRig | null
  /** The model being replaced, shown under `rig` while it fades in. */
  leaving: ModelRig | null
  finishSwap: () => void
  framing: ModelViewerFraming
  weights: ModelViewerWeights | undefined
  targetNames: readonly string[] | undefined
  expressions: ModelViewerExpressions | undefined
  material: ModelViewerMaterial
  loop: boolean
  speed: number
  autoRotate: number
}

// Seconds the new model takes to fade in over the one it replaces; the old one goes in the last part of it.
const swapDuration = 0.45
const swapHold = 0.6

/**
 * Drives the rig from the render loop: a frame is asked for when the viewer's state changes or new weights arrive,
 * and again only while the rig says something still moves. React never renders per frame, and a frame allocates
 * nothing.
 */
function useModelFrame(options: ModelFrameOptions) {
  const { handle, rig, leaving, finishSwap, framing, weights, targetNames, expressions, material } = options
  const { loop, speed, autoRotate } = options
  const camera = useThree((state) => state.camera) as PerspectiveCamera
  const invalidate = useThree((state) => state.invalidate)
  const frameloop = useThree((state) => state.frameloop)

  useEffect(() => handle.subscribe(() => invalidate()), [handle, invalidate])
  useEffect(() => {
    if (frameloop !== "never") invalidate()
  }, [frameloop, invalidate])

  // The first model's first weights apply at once; later ones ease, and a replacing model eases from the old one's.
  const weighted = useRef(false)
  useEffect(() => {
    if (!rig) return
    rig.setTargetNames(targetNames)
    rig.setWeights(weights, expressions, !weighted.current)
    weighted.current = true
    invalidate()
  }, [rig, targetNames, weights, expressions, invalidate])
  useEffect(() => {
    rig?.setMaterial(material)
    leaving?.setMaterial(material)
    invalidate()
  }, [rig, leaving, material, invalidate])

  const input = useRef<RigInput>({ handle, camera, framing, loop, speed, autoRotate })
  useEffect(() => {
    Object.assign(input.current, { handle, camera, framing, loop, speed, autoRotate })
    invalidate()
  }, [handle, camera, framing, loop, speed, autoRotate, invalidate])

  const swap = useRef({ from: null as ModelRig | null, t: 0 })

  useFrame((state, delta) => {
    if (!rig) return
    // A long gap (a hidden tab, a stage scrolled back in) would jump a clip or a tween; a frame counts at most 50 ms.
    const dt = Math.min(delta, 0.05)
    const result = rig.update(dt, input.current)
    if (result.moving) state.invalidate()
    if (result.justSettled) {
      const { yaw, pitch, zoom } = result.camera
      // Where the camera came to rest, for tests and tooling; written only when it stops.
      state.gl.domElement.dataset.camera = `${yaw.toFixed(1)} ${pitch.toFixed(1)} ${zoom.toFixed(2)}`
    }
    if (!leaving) return
    const fade = swap.current
    if (fade.from !== leaving) {
      fade.from = leaving
      fade.t = 0
    }
    fade.t = handle.get().reducedMotion ? 1 : Math.min(1, fade.t + dt / swapDuration)
    rig.setOpacity(Math.min(1, fade.t / swapHold), "swap")
    leaving.setOpacity(fade.t < swapHold ? 1 : 1 - (fade.t - swapHold) / (1 - swapHold), "swap")
    state.invalidate()
    if (fade.t < 1) return
    rig.setOpacity(1, "swap")
    fade.from = null
    finishSwap()
  })
}

export { loadModel, useModelFrame, useModelRig, useSceneFrameloop }
export type { ModelViewerLoadInfo, ModelViewerSource }
