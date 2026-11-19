import { readFileSync } from "node:fs"
import { join } from "node:path"

import { checkServer } from "@ui-sdk/core/testing"
import { MeshToonMaterial, PerspectiveCamera, type Mesh } from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import { describe, expect, test } from "vitest"

import { modelViewer, type ModelViewerHandle, type ModelViewerState } from "@/components/ui/model-viewer-primitive"
import { createModelRig } from "@/components/ui/model-viewer-rig"
import { orbitPosition, viewAngles } from "@/components/ui/model-viewer-math"

const bytes = readFileSync(join(import.meta.dirname, "fixtures", "model", "figure.glb"))

async function loadFigure() {
  // Copied into this realm's ArrayBuffer: GLTFLoader checks for one with instanceof.
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
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
  test("has its morph targets and clips, under a hundred and twenty kilobytes", async () => {
    const rig = createModelRig(await loadFigure())
    expect(rig.morphNames.toSorted()).toEqual(["Blink", "Build", "HeadSize", "Smile"])
    expect(rig.clipNames).toEqual(["Idle", "Wave"])
    expect(bytes.byteLength).toBeLessThan(120_000)
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
    rig.setWeights({ Smile: 1, Build: 0.5 })
    const head = model.scene.getObjectByName("Head") as Mesh
    const smile = head.morphTargetDictionary?.Smile ?? -1
    const first = rig.update(1 / 60, input)
    expect(first.moving).toBe(true)
    const after = head.morphTargetInfluences?.[smile] ?? 0
    expect(after).toBeGreaterThan(0.1)
    expect(after).toBeLessThan(0.2)
    let frames = 1
    while (rig.update(1 / 60, input).moving && frames < 300) frames += 1
    expect(head.morphTargetInfluences?.[smile]).toBe(1)
    expect(frames).toBeLessThan(60)
    rig.setWeights({ Smile: 0 }, true)
    expect(head.morphTargetInfluences?.[smile]).toBe(0)
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
    rig.dispose(true)
  })
})

test("the viewer renders on the server without a model", () => {
  checkServer(modelViewer, { load: false }, `<root><stage label="Figure"></stage></root>`)
})
