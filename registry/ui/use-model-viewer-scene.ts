import { useFrame, useThree } from "@react-three/fiber"
import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react"
import type { AnimationClip, Object3D, PerspectiveCamera } from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"

import type { ModelViewerFraming, WeightMap } from "@/components/ui/model-viewer-math"
import type { ModelViewerHandle } from "@/components/ui/model-viewer-primitive"
import {
  createModelRig,
  type LoadedModel,
  type ModelRig,
  type ModelViewerMaterial,
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

/** Loads the model and builds its rig; the viewer's status follows. A new source replaces and disposes the old one. */
function useModelRig(
  source: ModelViewerSource | undefined,
  handle: ModelViewerHandle,
  onLoad?: (info: ModelViewerLoadInfo) => void,
  onError?: (error: Error) => void,
) {
  const [loaded, setLoaded] = useState<{ source: ModelViewerSource; rig: ModelRig } | null>(null)
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
    let current: ModelRig | undefined
    let cancelled = false
    handle.api.loading()
    loadModel(source).then(
      (model) => {
        if (cancelled) return
        current = createModelRig(model)
        setLoaded({ source, rig: current })
        loadedEvent(current)
      },
      (error: unknown) => {
        if (!cancelled) failedEvent(error)
      },
    )
    return () => {
      cancelled = true
      current?.dispose(owns(source))
    }
  }, [source, handle])
  return loaded && loaded.source === source ? loaded.rig : null
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
  framing: ModelViewerFraming
  weights: WeightMap | undefined
  material: ModelViewerMaterial
  loop: boolean
  speed: number
  autoRotate: number
}

/**
 * Drives the rig from the render loop: a frame is asked for when the viewer's state changes or new weights arrive,
 * and again only while the rig says something still moves. React never renders per frame.
 */
function useModelFrame({ handle, rig, framing, weights, material, loop, speed, autoRotate }: ModelFrameOptions) {
  const camera = useThree((state) => state.camera) as PerspectiveCamera
  const invalidate = useThree((state) => state.invalidate)
  const frameloop = useThree((state) => state.frameloop)

  useEffect(() => handle.subscribe(() => invalidate()), [handle, invalidate])
  useEffect(() => {
    if (frameloop !== "never") invalidate()
  }, [frameloop, invalidate])

  // A model's first weights apply at once; later ones ease.
  const weighted = useRef<ModelRig | null>(null)
  useEffect(() => {
    if (!rig) return
    rig.setWeights(weights ?? {}, weighted.current !== rig)
    weighted.current = rig
    invalidate()
  }, [rig, weights, invalidate])
  useEffect(() => {
    rig?.setMaterial(material)
    invalidate()
  }, [rig, material, invalidate])
  const inputs = useRef({ framing, loop, speed, autoRotate })
  useEffect(() => {
    inputs.current = { framing, loop, speed, autoRotate }
    invalidate()
  }, [framing, loop, speed, autoRotate, invalidate])

  useFrame((state, delta) => {
    if (!rig) return
    // A long gap (a hidden tab, a stage scrolled back in) would jump a clip or a tween; a frame counts at most 50 ms.
    const result = rig.update(Math.min(delta, 0.05), { handle, camera, ...inputs.current })
    if (result.moving) state.invalidate()
    if (result.justSettled) {
      const { yaw, pitch, zoom } = result.camera
      // Where the camera came to rest, for tests and tooling; written only when it stops.
      state.gl.domElement.dataset.camera = `${yaw.toFixed(1)} ${pitch.toFixed(1)} ${zoom.toFixed(2)}`
    }
  })
}

export { loadModel, useModelFrame, useModelRig, useSceneFrameloop }
export type { ModelViewerLoadInfo, ModelViewerSource }
