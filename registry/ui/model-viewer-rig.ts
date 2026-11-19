import { createContext } from "react"
import {
  AnimationMixer,
  Box3,
  DataTexture,
  LoopOnce,
  LoopRepeat,
  Mesh,
  MeshToonMaterial,
  NearestFilter,
  RedFormat,
  Vector3,
  type AnimationAction,
  type AnimationClip,
  type Material,
  type MeshStandardMaterial,
  type Object3D,
  type PerspectiveCamera,
} from "three"

import {
  damp,
  dampWeights,
  fitBoxDistance,
  fitSphereDistance,
  orbitPosition,
  type ModelViewerFraming,
  type WeightMap,
} from "@/components/ui/model-viewer-math"
import type { ModelViewerHandle } from "@/components/ui/model-viewer-primitive"

type LoadedModel = { scene: Object3D; animations: readonly AnimationClip[] }

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

type MorphMesh = Mesh & { morphTargetDictionary: Record<string, number>; morphTargetInfluences: number[] }

const isMesh = (object: Object3D): object is Mesh => (object as Mesh).isMesh === true

/** Three tones of light, read nearest, for the toon look. */
function toonGradient() {
  const texture = new DataTexture(new Uint8Array([90, 170, 255]), 3, 1, RedFormat)
  texture.minFilter = NearestFilter
  texture.magFilter = NearestFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return texture
}

function toonOf(material: Material, gradientMap: DataTexture) {
  const source = material as MeshStandardMaterial
  return new MeshToonMaterial({
    name: material.name,
    color: source.color,
    map: source.map ?? null,
    vertexColors: source.vertexColors,
    transparent: source.transparent,
    opacity: source.opacity,
    side: source.side,
    gradientMap,
  })
}

/**
 * Everything a loaded model does per frame, outside React: the camera eased to the orbit the primitive holds, morph
 * weights eased to their targets, and the animation mixer. `update` says whether it needs another frame, so the
 * canvas draws only while something moves.
 */
function createModelRig(model: LoadedModel) {
  const box = new Box3().setFromObject(model.scene)
  const size = box.getSize(new Vector3())
  const boxCenter = box.getCenter(new Vector3())
  const meshes: MorphMesh[] = []
  const surfaces: Mesh[] = []
  model.scene.traverse((object) => {
    if (!isMesh(object)) return
    surfaces.push(object)
    if (object.morphTargetDictionary && object.morphTargetInfluences) meshes.push(object as MorphMesh)
  })
  const morphNames = [...new Set(meshes.flatMap((mesh) => Object.keys(mesh.morphTargetDictionary)))]
  const clipNames = model.animations.map((clip) => clip.name)
  const mixer = new AnimationMixer(model.scene)
  const actions = new Map<string, AnimationAction>()
  for (const clip of model.animations) actions.set(clip.name, mixer.clipAction(clip as AnimationClip))

  const originals = new Map(surfaces.map((mesh) => [mesh, mesh.material]))
  let gradient: DataTexture | undefined
  const toons = new Map<Material, MeshToonMaterial>()
  let material: ModelViewerMaterial = "standard"
  let opacity = 1

  let weights: WeightMap = {}
  let targetWeights: WeightMap = {}
  let weightsSettled = true

  const camera = { yaw: 0, pitch: 0, zoom: 1, distance: 0, turn: -1, ready: false }
  const center = new Vector3()
  const goalCenter = new Vector3()
  let settled = false
  let activeClip: string | null = null
  let wasPlaying = false

  const applyWeights = () => {
    for (const mesh of meshes) {
      for (const [name, value] of Object.entries(weights)) {
        const index = mesh.morphTargetDictionary[name]
        if (index !== undefined) mesh.morphTargetInfluences[index] = value
      }
    }
  }

  const eachMaterial = (run: (material: Material) => void) => {
    for (const mesh of surfaces) for (const item of [mesh.material].flat()) run(item)
  }

  const applyOpacity = () => {
    eachMaterial((item) => {
      item.transparent = opacity < 1
      item.opacity = opacity
      item.depthWrite = opacity >= 1
      item.needsUpdate = true
    })
  }

  const rig = {
    scene: model.scene,
    morphNames,
    clipNames,
    /** The box's centre and size, in the model's units. */
    bounds: { center: boxCenter, size },
    /** New target weights; `immediate` jumps to them, like the first weights of a model. */
    setWeights(next: WeightMap, immediate = false) {
      targetWeights = next
      weightsSettled = false
      if (immediate) {
        weights = dampWeights(weights, next, weightRate, Number.POSITIVE_INFINITY).next
        weightsSettled = true
        applyWeights()
      }
    },
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
    /** Fades the whole model, for a reveal. */
    setOpacity(next: number) {
      if (next === opacity) return
      opacity = next
      applyOpacity()
    },
    /** Where the camera looks and how far it stands at zoom 1, for the current framing and aspect. */
    frame(framing: ModelViewerFraming, view: PerspectiveCamera) {
      if (framing === "full") {
        return { center: boxCenter, distance: fitBoxDistance([size.x, size.y, size.z], view.fov, view.aspect) }
      }
      return {
        center: new Vector3(...framing.center),
        distance: fitSphereDistance(framing.radius, view.fov, view.aspect),
      }
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

      const framed = rig.frame(input.framing, view)
      goalCenter.copy(framed.center)
      if (!camera.ready || state.turn !== camera.turn) {
        if (!camera.ready || state.motion === "jump") {
          camera.yaw = state.yaw
          camera.pitch = state.pitch
          camera.zoom = state.zoom
        }
        if (!camera.ready) {
          center.copy(goalCenter)
          camera.distance = framed.distance
        }
        camera.turn = state.turn
        camera.ready = true
        settled = false
      }
      const step = (from: number, to: number, epsilon: number) => {
        if (jump || Math.abs(from - to) < epsilon) return to
        moving = true
        return damp(from, to, cameraRate, dt)
      }
      const before = moving
      moving = false
      camera.yaw = step(camera.yaw, state.yaw, angleEpsilon)
      camera.pitch = step(camera.pitch, state.pitch, angleEpsilon)
      camera.zoom = step(camera.zoom, state.zoom, relativeEpsilon)
      camera.distance = step(camera.distance, framed.distance, framed.distance * relativeEpsilon)
      center.set(
        step(center.x, goalCenter.x, camera.distance * relativeEpsilon),
        step(center.y, goalCenter.y, camera.distance * relativeEpsilon),
        step(center.z, goalCenter.z, camera.distance * relativeEpsilon),
      )
      const cameraMoving = moving
      moving = before || cameraMoving
      const distance = camera.distance / camera.zoom
      const [x, y, z] = orbitPosition([center.x, center.y, center.z], camera.yaw, camera.pitch, distance)
      view.position.set(x, y, z)
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
        const result = dampWeights(weights, targetWeights, weightRate, dt)
        weights = result.next
        weightsSettled = result.settled
        moving = true
      }
      applyWeights()

      // The camera reports where it came to rest, even while a clip keeps the frames coming.
      const justSettled = !cameraMoving && !settled
      if (!cameraMoving) settled = true
      return { moving, justSettled, camera: { yaw: camera.yaw, pitch: camera.pitch, zoom: camera.zoom } }
    },
    dispose(owned: boolean) {
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
