import { createContext } from "react"
import {
  AnimationMixer,
  Box3,
  DataTexture,
  LoopOnce,
  LoopRepeat,
  Mesh,
  MeshToonMaterial,
  Vector3,
  type AnimationAction,
  type AnimationClip,
  type Material,
  type Object3D,
  type PerspectiveCamera,
} from "three"

import {
  damp,
  dampInto,
  fitBoxDistance,
  fitSphereDistance,
  writeTargets,
  type ModelViewerExpressions,
  type ModelViewerFraming,
  type ModelViewerWeights,
} from "@/components/ui/model-viewer-math"
import {
  isMesh,
  signatureOf,
  targetNamesOf,
  targetScalesOf,
  toonGradient,
  toonOf,
  type MorphMesh,
} from "@/components/ui/model-viewer-meshes"
import type { ModelViewerHandle } from "@/components/ui/model-viewer-primitive"

type LoadedModel = { scene: Object3D; animations: readonly AnimationClip[] }

/** One target on one mesh, and what a weight is multiplied by there: its `extras.targetScales` entry, or 1. */
type Binding = { influences: number[]; index: number; scale: number }

type ModelViewerMaterial = "standard" | "toon"

type RigInput = {
  handle: ModelViewerHandle
  camera: PerspectiveCamera
  framing: ModelViewerFraming
  loop: boolean
  speed: number
  /** Degrees per second; 0 holds still. */
  autoRotate: number
}

// Per second: the camera eases over about a second and a half, weights over about a third of one.
const cameraRate = 4
const weightRate = 10
const clipFade = 0.3

const angleEpsilon = 0.02
const relativeEpsilon = 1e-4

type Channels = {
  index: ReadonlyMap<string, number>
  current: Float32Array
  target: Float32Array
  active: Uint8Array
}

type CameraState = { yaw: number; pitch: number; zoom: number; distance: number; turn: number; ready: boolean }

/** What a replacing model takes over from the one it replaces. */
type RigSnapshot = {
  cameraState: () => CameraState
  centerNow: () => Vector3
  channels: () => Channels
  clipState: () => { name: string | null; time: number }
  reveal: () => number
}

/**
 * Everything a loaded model does per frame, outside React: the camera eased to the orbit the primitive holds, morph
 * weights eased to their targets, and the animation mixer. `update` says whether it needs another frame, so the
 * canvas draws only while something moves. `cleanup` runs on dispose, for what an `onModelLoad` made.
 */
function createModelRig(model: LoadedModel, owned = true, cleanup?: () => void) {
  const box = new Box3().setFromObject(model.scene)
  const size = box.getSize(new Vector3())
  const boxCenter = box.getCenter(new Vector3())
  const boxSize = [size.x, size.y, size.z] as const
  const meshes: MorphMesh[] = []
  const surfaces: Mesh[] = []
  model.scene.traverse((object) => {
    if (!isMesh(object)) return
    surfaces.push(object)
    if (object.morphTargetDictionary && object.morphTargetInfluences) meshes.push(object as MorphMesh)
  })
  const morphNames = targetNamesOf(meshes)
  const scales = new Map(meshes.map((mesh) => [mesh, targetScalesOf(mesh)]))
  // Meshes with their own scales bind first, so a copy that shares their influences without them doesn't win.
  const scaledFirst = meshes.toSorted((a, b) => Number(!scales.get(a)) - Number(!scales.get(b)))
  const signature = signatureOf(surfaces)
  const clipNames = model.animations.map((clip) => clip.name)
  const mixer = new AnimationMixer(model.scene)
  const actions = new Map<string, AnimationAction>()
  for (const clip of model.animations) actions.set(clip.name, mixer.clipAction(clip as AnimationClip))

  const originals = new Map(surfaces.map((mesh) => [mesh, mesh.material]))
  let gradient: DataTexture | undefined
  const toons = new Map<Material, MeshToonMaterial>()
  let material: ModelViewerMaterial = "standard"
  // Two fades multiply: a reveal (ModelScan's photo turning into the model) and a swap (a new model over the old).
  const fades = { reveal: 1, swap: 1 }
  let opacity = 1

  // One channel per target name: where it is, where it goes, and whether the consumer drives it (an undriven one
  // is left to clips). The bindings to each mesh's influences are found once, so a frame only copies numbers.
  let names: readonly string[] = morphNames
  let index = new Map<string, number>()
  let current = new Float32Array(0)
  let target = new Float32Array(0)
  let active = new Uint8Array(0)
  let bindings: Binding[][] = []
  // Each channel's multiplier, from its first binding: what weights sent already scaled are divided by.
  let channelScales = new Float32Array(0)
  let weightsSettled = true
  const bind = (next: readonly string[]) => {
    const previous = { index, current, target, active }
    names = next
    index = new Map(next.map((name, i) => [name, i]))
    current = new Float32Array(next.length)
    target = new Float32Array(next.length)
    active = new Uint8Array(next.length)
    // A mesh that shares another's influences (an outline hull drawn from the same morphs) is written once.
    bindings = next.map((name) => {
      const found: Binding[] = []
      for (const mesh of scaledFirst) {
        const at = mesh.morphTargetDictionary[name]
        if (at === undefined || found.some((binding) => binding.influences === mesh.morphTargetInfluences)) continue
        found.push({ influences: mesh.morphTargetInfluences, index: at, scale: scales.get(mesh)?.[at] ?? 1 })
      }
      return found
    })
    channelScales = Float32Array.from(bindings, (found) => found[0]?.scale ?? 1)
    copyChannels(previous)
  }
  const copyChannels = (from: Channels) => {
    for (const [name, i] of index) {
      const j = from.index.get(name)
      if (j === undefined) continue
      current[i] = from.current[j] ?? 0
      target[i] = from.target[j] ?? 0
      active[i] = from.active[j] ?? 0
    }
  }
  bind(morphNames)

  const camera: CameraState = { yaw: 0, pitch: 0, zoom: 1, distance: 0, turn: -1, ready: false }
  // Reused every frame, so the render loop allocates nothing.
  const result = { moving: false, justSettled: false, camera: { yaw: 0, pitch: 0, zoom: 1 } }
  const framed = { center: new Vector3(), distance: 0 }
  const stepping = { dt: 0, jump: false, moved: false }
  const step = (from: number, to: number, epsilon: number) => {
    if (stepping.jump || Math.abs(from - to) < epsilon) return to
    stepping.moved = true
    return damp(from, to, cameraRate, stepping.dt)
  }
  const center = new Vector3()
  const goalCenter = new Vector3()
  let settled = false
  let activeClip: string | null = null
  let wasPlaying = false

  const applyWeights = () => {
    for (let i = 0; i < bindings.length; i += 1) {
      if (!active[i]) continue
      const value = current[i] ?? 0
      const targets = bindings[i] ?? []
      for (let j = 0; j < targets.length; j += 1) {
        const binding = targets[j] as Binding
        binding.influences[binding.index] = value * binding.scale
      }
    }
  }

  const eachMaterial = (run: (material: Material) => void) => {
    for (const mesh of surfaces) for (const item of [mesh.material].flat()) run(item)
  }

  const applyOpacity = () => {
    eachMaterial((item) => {
      // Only a change between opaque and transparent needs the program checked again, not every step of a fade.
      if (item.transparent !== opacity < 1) item.needsUpdate = true
      item.transparent = opacity < 1
      item.opacity = opacity
      // Depth writes stay on while fading: a model of several meshes (a body, eyes, hair) still hides what is behind
      // its own surfaces, instead of showing its eyes and the back of its hair through its face.
    })
  }

  const rig = {
    scene: model.scene,
    morphNames,
    clipNames,
    signature,
    owned,
    /** The order aligned weights follow: `next`, or the GLB's own (`extras.targetNames`). */
    setTargetNames(next: readonly string[] | undefined) {
      const order = next && next.length > 0 ? next : morphNames
      if (order.length === names.length && order.every((name, i) => names[i] === name)) return
      bind(order)
    },
    targetNames: () => names,
    /** The box's centre and size, in the model's units. */
    bounds: { center: boxCenter, size },
    /**
     * New target weights and expressions; `immediate` jumps to them, like the first weights of a model. `scaled`
     * weights come already multiplied by the GLB's `extras.targetScales`; expressions never do.
     */
    setWeights(
      weights: ModelViewerWeights | undefined,
      expressions?: ModelViewerExpressions,
      immediate = false,
      scaled = false,
    ) {
      writeTargets(index, target, active, weights, expressions, scaled ? channelScales : undefined)
      weightsSettled = false
      if (immediate) {
        for (let i = 0; i < current.length; i += 1) if (active[i]) current[i] = target[i] ?? 0
        weightsSettled = true
        applyWeights()
      }
    },
    /** The current weight of a target as given, before its `extras.targetScales` multiplier, for tests and tools. */
    weight: (name: string) => {
      const i = index.get(name)
      return i === undefined ? undefined : current[i]
    },
    /**
     * Takes over from the model this one replaces: where its camera is, its weights as they are now (so nothing
     * jumps when the new one shows), and how far into the same clip it was.
     */
    inherit(previous: RigSnapshot) {
      Object.assign(camera, previous.cameraState())
      center.copy(previous.centerNow())
      copyChannels(previous.channels())
      rig.setOpacity(previous.reveal(), "reveal")
      weightsSettled = false
      applyWeights()
      const clip = previous.clipState()
      const action = clip.name ? actions.get(clip.name) : undefined
      if (action && clip.name) {
        action.play()
        action.time = clip.time
        activeClip = clip.name
        mixer.update(0)
      }
    },
    cameraState: () => ({ ...camera }),
    centerNow: () => center,
    channels: (): Channels => ({ index, current, target, active }),
    clipState: () => ({ name: activeClip, time: activeClip ? (actions.get(activeClip)?.time ?? 0) : 0 }),
    setMaterial(next: ModelViewerMaterial) {
      if (next === material) return
      material = next
      if (next === "toon") gradient ??= toonGradient()
      for (const mesh of surfaces) {
        const original = originals.get(mesh) ?? mesh.material
        if (next === "standard") {
          mesh.material = original
          continue
        }
        const swap = (item: Material) => {
          let toon = toons.get(item)
          if (!toon) {
            toon = toonOf(item, gradient as DataTexture)
            toons.set(item, toon)
          }
          return toon
        }
        mesh.material = Array.isArray(original) ? original.map(swap) : swap(original)
      }
      applyOpacity()
    },
    /** Fades the whole model: `reveal` for an entrance, `swap` while a new model replaces it. */
    setOpacity(next: number, fade: "reveal" | "swap" = "reveal") {
      fades[fade] = next
      const combined = fades.reveal * fades.swap
      if (combined === opacity) return
      opacity = combined
      applyOpacity()
    },
    reveal: () => fades.reveal,
    /** Where the camera looks and how far it stands at zoom 1, for the current framing and aspect. */
    frame(framing: ModelViewerFraming, view: PerspectiveCamera) {
      if (framing === "full") {
        framed.center.copy(boxCenter)
        framed.distance = fitBoxDistance(boxSize, view.fov, view.aspect)
      } else {
        framed.center.fromArray(framing.center)
        framed.distance = fitSphereDistance(framing.radius, view.fov, view.aspect)
      }
      return framed
    },
    /** Moves everything one frame on; true while something still moves. */
    update(dt: number, input: RigInput) {
      const { handle, camera: view } = input
      const state = handle.get()
      const jump = state.reducedMotion
      let moving = false

      if (input.autoRotate !== 0 && !state.reducedMotion && !state.dragging && state.status === "ready") {
        handle.api.spin(input.autoRotate * dt)
        moving = true
      }

      const goal = rig.frame(input.framing, view)
      goalCenter.copy(goal.center)
      stepping.dt = dt
      stepping.jump = jump
      if (!camera.ready || state.turn !== camera.turn) {
        if (!camera.ready || state.motion === "jump") {
          camera.yaw = state.yaw
          camera.pitch = state.pitch
          camera.zoom = state.zoom
        }
        if (!camera.ready) {
          center.copy(goalCenter)
          camera.distance = goal.distance
        }
        camera.turn = state.turn
        camera.ready = true
        settled = false
      }
      stepping.moved = false
      camera.yaw = step(camera.yaw, state.yaw, angleEpsilon)
      camera.pitch = step(camera.pitch, state.pitch, angleEpsilon)
      camera.zoom = step(camera.zoom, state.zoom, relativeEpsilon)
      camera.distance = step(camera.distance, goal.distance, goal.distance * relativeEpsilon)
      center.set(
        step(center.x, goalCenter.x, camera.distance * relativeEpsilon),
        step(center.y, goalCenter.y, camera.distance * relativeEpsilon),
        step(center.z, goalCenter.z, camera.distance * relativeEpsilon),
      )
      const cameraMoving = stepping.moved
      if (cameraMoving) moving = true
      const distance = camera.distance / camera.zoom
      const yaw = (camera.yaw * Math.PI) / 180
      const pitch = (camera.pitch * Math.PI) / 180
      view.position.set(
        center.x + distance * Math.sin(yaw) * Math.cos(pitch),
        center.y + distance * Math.sin(pitch),
        center.z + distance * Math.cos(yaw) * Math.cos(pitch),
      )
      view.lookAt(center)
      const near = distance / 100
      if (Math.abs(view.near - near) > near * 0.1) {
        view.near = near
        view.far = distance * 100
        view.updateProjectionMatrix()
      }

      const clip = handle.api.currentClip()
      const playing = handle.api.isPlaying()
      if (clip !== activeClip) {
        const previous = activeClip ? actions.get(activeClip) : undefined
        const next = clip ? actions.get(clip) : undefined
        const fade = state.reducedMotion || !previous ? 0 : clipFade
        if (previous) previous.fadeOut(fade)
        if (next) next.reset().fadeIn(fade).play()
        activeClip = clip
        mixer.update(0)
      }
      const action = activeClip ? actions.get(activeClip) : undefined
      if (action) {
        action.setLoop(input.loop ? LoopRepeat : LoopOnce, Number.POSITIVE_INFINITY)
        action.clampWhenFinished = true
        action.paused = !playing
        if (playing && !wasPlaying && !action.isRunning() && action.time >= action.getClip().duration) action.reset()
        mixer.timeScale = input.speed
        if (playing && (action.isRunning() || action.getEffectiveWeight() < 1)) {
          mixer.update(dt)
          moving = true
        }
      }
      wasPlaying = playing

      if (!weightsSettled) {
        weightsSettled = dampInto(current, target, active, weightRate, dt)
        moving = true
      }
      applyWeights()

      // The camera reports where it came to rest, even while a clip keeps the frames coming.
      result.justSettled = !cameraMoving && !settled
      if (!cameraMoving) settled = true
      result.moving = moving
      result.camera.yaw = camera.yaw
      result.camera.pitch = camera.pitch
      result.camera.zoom = camera.zoom
      return result
    },
    dispose() {
      cleanup?.()
      mixer.stopAllAction()
      mixer.uncacheRoot(model.scene)
      for (const toon of toons.values()) toon.dispose()
      gradient?.dispose()
      if (!owned) return
      model.scene.traverse((object) => {
        if (!isMesh(object)) return
        object.geometry.dispose()
        for (const item of [object.material].flat()) {
          for (const value of Object.values(item))
            if (value && typeof value === "object" && "isTexture" in value) value.dispose()
          item.dispose()
        }
      })
    },
  }
  return rig
}

type ModelRig = ReturnType<typeof createModelRig>

type ModelViewerSceneState = {
  handle: ModelViewerHandle
  /** The loaded model's rig, or null while it loads. */
  rig: ModelRig | null
  framing: ModelViewerFraming
}

/** What content inside the canvas (`sceneChildren`) can read: the viewer, and the model once it has loaded. */
const ModelViewerSceneContext = createContext<ModelViewerSceneState | null>(null)

export { createModelRig, ModelViewerSceneContext }
export type { LoadedModel, ModelRig, ModelViewerMaterial, ModelViewerSceneState, RigInput }
