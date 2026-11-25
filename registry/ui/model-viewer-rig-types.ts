import type { PerspectiveCamera, Object3D, Vector3 } from "three"

import type { ModelViewerExpressions, ModelViewerFraming, ModelViewerWeights } from "@/components/ui/model-viewer-math"
import type { ModelViewerMaterial, RigInput } from "@/components/ui/model-viewer-rig"

type Channels = {
  index: ReadonlyMap<string, number>
  current: Float32Array
  target: Float32Array
  active: Uint8Array
}

type CameraState = { yaw: number; pitch: number; zoom: number; distance: number; turn: number; ready: boolean }

type RigSnapshot = {
  cameraState: () => CameraState
  centerNow: () => Vector3
  channels: () => Channels
  clipState: () => { name: string | null; time: number }
  reveal: () => number
}

type RigFrame = { moving: boolean; justSettled: boolean; camera: { yaw: number; pitch: number; zoom: number } }

type ModelRig = RigSnapshot & {
  scene: Object3D
  morphNames: readonly string[]
  clipNames: readonly string[]
  signature: string
  owned: boolean
  /** The order aligned weights follow: `next`, or the GLB's own (`extras.targetNames`) when it's empty. */
  setTargetNames: (next: readonly string[] | undefined) => void
  targetNames: () => readonly string[]
  /** The box's centre and size, in the model's units. */
  bounds: { center: Vector3; size: Vector3 }
  /** New weights and expressions: `immediate` jumps there; `scaled` weights come multiplied by `extras.targetScales`. */
  setWeights: (
    weights: ModelViewerWeights | undefined,
    expressions?: ModelViewerExpressions,
    immediate?: boolean,
    scaled?: boolean,
  ) => void
  /** A target's current weight as given, before its `extras.targetScales` multiplier; for tests and tools. */
  weight: (name: string) => number | undefined
  /** Takes over the replaced model's camera, its weights as they are now and its place in the same clip. */
  inherit: (previous: RigSnapshot) => void
  setMaterial: (next: ModelViewerMaterial) => void
  /** Fades the whole model, 0 to 1: `reveal` for an entrance, `swap` while a new model replaces it. */
  setOpacity: (next: number, fade?: "reveal" | "swap") => void
  /** Where the camera looks and how far it stands at zoom 1, for the framing and the camera's aspect. */
  frame: (framing: ModelViewerFraming, view: PerspectiveCamera) => { center: Vector3; distance: number }
  /** Moves everything `dt` seconds on; `moving` is true while something still moves. */
  update: (dt: number, input: RigInput) => RigFrame
  dispose: () => void
}

export type { CameraState, Channels, ModelRig, RigFrame, RigSnapshot }
