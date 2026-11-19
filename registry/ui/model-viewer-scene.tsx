"use client"

import { Canvas } from "@react-three/fiber"
import { Suspense, type ReactNode } from "react"

import {
  fieldOfView,
  type ModelViewerExpressions,
  type ModelViewerFraming,
  type ModelViewerWeights,
} from "@/components/ui/model-viewer-math"
import type { ModelViewerHandle } from "@/components/ui/model-viewer-primitive"
import { ModelViewerSceneContext, type ModelViewerMaterial } from "@/components/ui/model-viewer-rig"
import {
  useModelFrame,
  useModelRig,
  useSceneFrameloop,
  type ModelViewerLoadInfo,
  type ModelViewerSource,
} from "@/components/ui/use-model-viewer-scene"

type ModelViewerSceneProps = {
  handle: ModelViewerHandle
  model: ModelViewerSource | undefined
  framing: ModelViewerFraming
  weights: ModelViewerWeights | undefined
  targetNames: readonly string[] | undefined
  expressions: ModelViewerExpressions | undefined
  material: ModelViewerMaterial
  loop: boolean
  speed: number
  autoRotate: number
  onLoad?: (info: ModelViewerLoadInfo) => void
  onError?: (error: Error) => void
  children?: ReactNode
}

// A neutral rig: a soft sky over a grey floor, a key from the front left and a rim from behind, all white, so a
// model's own colours read the same in light and dark mode.
function Lights() {
  return (
    <>
      <hemisphereLight args={["#ffffff", "#8c8c8c", 2.2]} />
      <directionalLight position={[2.5, 4, 3.5]} intensity={1.8} />
      <directionalLight position={[-3, 2.5, -3]} intensity={1.2} />
    </>
  )
}

function ModelLayer({ handle, model, onLoad, onError, children, ...frame }: ModelViewerSceneProps) {
  const { rig, leaving, finishSwap } = useModelRig(model, handle, onLoad, onError)
  useModelFrame({ handle, rig, leaving, finishSwap, ...frame })
  return (
    <ModelViewerSceneContext value={{ handle, rig, framing: frame.framing }}>
      {/* Keyed by scene, so a swap mounts the new model and keeps the old one where it is. */}
      {leaving ? <primitive key={leaving.scene.uuid} object={leaving.scene} /> : null}
      {rig ? <primitive key={rig.scene.uuid} object={rig.scene} /> : null}
      <Suspense fallback={null}>{children}</Suspense>
    </ModelViewerSceneContext>
  )
}

/** The three.js half of ModelViewer, loaded on its own when a viewer first nears the viewport. */
function ModelViewerScene(props: ModelViewerSceneProps) {
  const frameloop = useSceneFrameloop(props.handle)
  return (
    <Canvas
      frameloop={frameloop}
      flat
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
      camera={{ fov: fieldOfView, position: [0, 0, 5] }}
      style={{ position: "absolute", inset: 0 }}
    >
      <Lights />
      <ModelLayer {...props} />
    </Canvas>
  )
}

export { ModelViewerScene }
export type { ModelViewerSceneProps }
