import { readFileSync } from "node:fs"
import { join } from "node:path"

import { checkServer } from "@ui-sdk/core/testing"
import { MeshToonMaterial, PerspectiveCamera, type Mesh } from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import { describe, expect, test } from "vitest"

import { modelViewer, type ModelViewerHandle, type ModelViewerState } from "@/components/ui/model-viewer-primitive"
import { createModelRig } from "@/components/ui/model-viewer-rig"

import { figureTargetNames } from "./fixtures/model/fake-engine"
import { orbitPosition, viewAngles } from "@/components/ui/model-viewer-math"

const read = (name: string) => readFileSync(join(import.meta.dirname, "fixtures", "model", name))
const bytes = read("figure.glb")

async function loadFigure(file = bytes) {
  // Copied into this realm's ArrayBuffer: GLTFLoader checks for one with instanceof.
  const buffer = new ArrayBuffer(file.byteLength)
  new Uint8Array(buffer).set(file)
  const gltf = await new GLTFLoader().parseAsync(buffer, "")
  return { scene: gltf.scene, animations: gltf.animations }
}

/** A handle over plain state, as the scene sees the viewer each frame. */
function fakeHandle(patch: Partial<ModelViewerState> = {}): { handle: ModelViewerHandle; state: ModelViewerState } {
  const state = {
    view: "front",
    yaw: 0,
    pitch: 0,
    zoom: 1,
    motion: "jump",
    turn: 0,
    dragging: false,
    clip: null,
    clips: ["Idle", "Wave"],
    playing: null,
    status: "ready",
    reducedMotion: false,
    inView: true,
    pageHidden: false,
    seen: true,
    interactive: true,
    load: true,
    ...patch,
  } as ModelViewerState
  const api = {
    currentClip: () => state.clip ?? state.clips[0] ?? null,
    isPlaying: () => state.playing ?? !state.reducedMotion,
    spin: (degrees: number) => {
      state.yaw += degrees
    },
  }
  return { handle: { get: () => state, subscribe: () => () => {}, api } as unknown as ModelViewerHandle, state }
}

const camera = () => Object.assign(new PerspectiveCamera(30, 0.75, 0.1, 100), {})

describe("the demo figure", () => {
  test("names its targets as the engine does, in extras.targetNames order, with two clips, under 140 KB", async () => {
    const rig = createModelRig(await loadFigure())
    expect(rig.morphNames).toEqual(figureTargetNames)
    expect(rig.targetNames()).toEqual(figureTargetNames)
    expect(rig.clipNames).toEqual(["Idle", "Wave"])
    expect(bytes.byteLength).toBeLessThan(140_000)
    expect(rig.bounds.size.y).toBeGreaterThan(1.6)
  })
})

describe("rig", () => {
  test("weights ease frame by frame toward their targets, and stop asking for frames once there", async () => {
    const model = await loadFigure()
    const rig = createModelRig(model)
    const { handle } = fakeHandle({ playing: false })
    const view = camera()
    const input = { handle, camera: view, framing: "full" as const, loop: true, speed: 1, autoRotate: 0 }
    rig.update(1 / 60, input)
    rig.setWeights({ "expr.mouthSmileLeft": 1, "body.pc00": 0.5 })
    const head = model.scene.getObjectByName("Head") as Mesh
    const smile = head.morphTargetDictionary?.["expr.mouthSmileLeft"] ?? -1
    const first = rig.update(1 / 60, input)
    expect(first.moving).toBe(true)
    const after = head.morphTargetInfluences?.[smile] ?? 0
    expect(after).toBeGreaterThan(0.1)
    expect(after).toBeLessThan(0.2)
    let frames = 1
    while (rig.update(1 / 60, input).moving && frames < 300) frames += 1
    expect(head.morphTargetInfluences?.[smile]).toBe(1)
    expect(frames).toBeLessThan(60)
    rig.setWeights(undefined, { mouthSmileLeft: 0 }, true)
    expect(head.morphTargetInfluences?.[smile]).toBe(0)
  })

  test("aligned weights follow the target names, from the GLB or passed in another order", async () => {
    const model = await loadFigure()
    const rig = createModelRig(model)
    const body = model.scene.getObjectByName("Body") as Mesh
    const head = model.scene.getObjectByName("Head") as Mesh
    rig.setWeights(new Float32Array([-1.2, 0.5]), undefined, true)
    expect(body.morphTargetInfluences?.[0]).toBeCloseTo(-1.2, 6)
    expect(head.morphTargetInfluences?.[head.morphTargetDictionary?.["face.head_size.incr"] ?? -1]).toBe(0.5)
    rig.setTargetNames(["expr.eyeBlinkRight", "body.pc00"])
    rig.setWeights(new Float32Array([1, 0.25]), undefined, true)
    expect(rig.weight("expr.eyeBlinkRight")).toBe(1)
    expect(body.morphTargetInfluences?.[0]).toBe(0.25)
  })

  test("a frame of easing weights allocates nothing", async () => {
    const rig = createModelRig(await loadFigure())
    const { handle } = fakeHandle({ playing: false })
    const input = { handle, camera: camera(), framing: "full" as const, loop: true, speed: 1, autoRotate: 0 }
    rig.update(1 / 60, input)
    rig.setWeights(new Float32Array([1, 1, 0, 1, 1, 0, 0]))
    const first = rig.update(1 / 60, input)
    // The same result object every frame, and the influences the same arrays.
    expect(rig.update(1 / 60, input)).toBe(first)
    const head = rig.scene.getObjectByName("Head") as Mesh
    const influences = head.morphTargetInfluences
    rig.update(1 / 60, input)
    expect(head.morphTargetInfluences).toBe(influences)
  })

  test("a replacing model takes over the camera, the weights as they are and the clip time", async () => {
    const { handle, state } = fakeHandle({ playing: false })
    const input = { handle, camera: camera(), framing: "full" as const, loop: true, speed: 1, autoRotate: 0 }
    const first = createModelRig(await loadFigure())
    first.update(1 / 60, input)
    Object.assign(state, { yaw: 35, pitch: 8, motion: "jump", turn: 1 })
    first.setWeights(new Float32Array([1]))
    first.update(0.05, input)
    const halfway = first.weight("body.pc00") ?? 0
    expect(halfway).toBeGreaterThan(0.2)
    expect(halfway).toBeLessThan(0.9)

    const same = createModelRig(await loadFigure())
    const other = createModelRig(await loadFigure(read("figure-final.glb")))
    expect(same.signature).toBe(first.signature)
    expect(other.signature).not.toBe(first.signature)
    other.inherit(first)
    expect(other.weight("body.pc00")).toBe(halfway)
    const moved = other.update(1 / 60, input)
    expect(moved.camera).toMatchObject({ yaw: 35, pitch: 8 })
    expect(other.weight("body.pc00")).toBeGreaterThan(halfway)
  })

  test("the camera eases to a new view, or jumps there under reduced motion, and reports where it rests", async () => {
    const rig = createModelRig(await loadFigure())
    const { handle, state } = fakeHandle({ playing: false })
    const view = camera()
    const input = { handle, camera: view, framing: "full" as const, loop: true, speed: 1, autoRotate: 0 }
    rig.update(1 / 60, input)
    const front = view.position.clone()
    const framed = rig.frame("full", view)
    expect(front.toArray()).toEqual(
      orbitPosition([framed.center.x, framed.center.y, framed.center.z], 0, 0, framed.distance).map((value) =>
        expect.closeTo(value, 6),
      ),
    )
    Object.assign(state, { ...viewAngles["three-quarter"], motion: "tween", turn: 1 })
    const half = rig.update(0.2, input)
    expect(half.moving).toBe(true)
    expect(half.camera.yaw).toBeGreaterThan(5)
    expect(half.camera.yaw).toBeLessThan(35)
    let rest = half
    for (let frame = 0; frame < 400 && !rest.justSettled; frame += 1) rest = rig.update(1 / 60, input)
    expect(rest.camera).toMatchObject({ yaw: 35, pitch: 8, zoom: 1 })

    Object.assign(state, { yaw: 90, pitch: 0, reducedMotion: true, motion: "jump", turn: 2 })
    expect(rig.update(1 / 60, input).camera.yaw).toBe(90)
  })

  test("a clip keeps frames coming while it plays, and none once paused", async () => {
    const rig = createModelRig(await loadFigure())
    const { handle, state } = fakeHandle()
    const input = { handle, camera: camera(), framing: "full" as const, loop: true, speed: 1, autoRotate: 0 }
    rig.update(1 / 60, input)
    expect(rig.update(1 / 60, input).moving).toBe(true)
    state.playing = false
    expect(rig.update(1 / 60, input).moving).toBe(false)
  })

  test("the toon material swaps every surface and back", async () => {
    const model = await loadFigure()
    const rig = createModelRig(model)
    const body = model.scene.getObjectByName("Body") as Mesh
    const original = body.material
    rig.setMaterial("toon")
    expect(body.material).toBeInstanceOf(MeshToonMaterial)
    rig.setMaterial("standard")
    expect(body.material).toBe(original)
    rig.dispose()
  })
})

test("the viewer renders on the server without a model", () => {
  checkServer(modelViewer, { load: false }, `<root><stage label="Figure"></stage></root>`)
})
