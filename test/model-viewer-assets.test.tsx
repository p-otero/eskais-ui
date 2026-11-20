import { readFileSync } from "node:fs"
import { join } from "node:path"

import { act, renderHook, waitFor } from "@testing-library/react"
import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  type SkinnedMesh,
} from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import { describe, expect, test, vi } from "vitest"

import { writeTargets } from "@/components/ui/model-viewer-math"
import type { ModelViewerHandle } from "@/components/ui/model-viewer-primitive"
import { createModelRig } from "@/components/ui/model-viewer-rig"
import { useModelRig } from "@/components/ui/use-model-viewer-scene"

import {
  idleScan,
  onBodyPhoto,
  placeFaceOnBody,
  reduceScan,
  replayScan,
  scanStage,
  toModelScanProps,
  type ScanEvent,
  type ScanRecording,
} from "./fixtures/model/character/scan-replay"

const character = join(import.meta.dirname, "fixtures", "model", "character")
const recording = JSON.parse(readFileSync(join(character, "scan-replay.json"), "utf8")) as ScanRecording

async function loadCharacter(file = "character-soft-toon.glb") {
  const bytes = readFileSync(join(character, file))
  // Copied into this realm's ArrayBuffer: GLTFLoader checks for one with instanceof.
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  const gltf = await new GLTFLoader().parseAsync(buffer, "")
  return { scene: gltf.scene, animations: gltf.animations }
}

/** A mesh with two morph targets, the second stored scaled by 0.01 as `extras.targetScales` says. */
function scaledModel(scales: unknown = [1, 0.01]) {
  const geometry = new BufferGeometry()
  geometry.setAttribute("position", new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3))
  geometry.morphAttributes.position = [
    new Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 1, 0], 3),
    new Float32BufferAttribute([1, 0, 0, 0, 0, 0, 0, 0, 0], 3),
  ]
  const mesh = new Mesh(geometry, new MeshStandardMaterial())
  mesh.morphTargetDictionary = { "body.pc00": 0, "expr.jawOpen": 1 }
  mesh.userData = { targetNames: ["body.pc00", "expr.jawOpen"], targetScales: scales }
  const scene = new Group()
  scene.add(mesh)
  return { scene, mesh, animations: [] }
}

const shape = (signature: string) => signature.replaceAll(/\|color:[^|]*/g, "")

const influence = (mesh: Mesh, name: string) => mesh.morphTargetInfluences?.[mesh.morphTargetDictionary?.[name] ?? -1]

describe("extras.targetScales", () => {
  test("a weight reaches the mesh times its target's scale; aligned, by name and as an expression alike", () => {
    const { scene, mesh, animations } = scaledModel()
    const rig = createModelRig({ scene, animations })
    rig.setWeights(new Float32Array([0.5, 0.8]), undefined, true)
    expect(influence(mesh, "body.pc00")).toBe(0.5)
    expect(influence(mesh, "expr.jawOpen")).toBeCloseTo(0.008, 7)
    rig.setWeights({ "expr.jawOpen": 1 }, undefined, true)
    expect(influence(mesh, "expr.jawOpen")).toBeCloseTo(0.01, 7)
    rig.setWeights(undefined, { jawOpen: 0.5 }, true)
    expect(influence(mesh, "expr.jawOpen")).toBeCloseTo(0.005, 7)
    // The weight as given, before its multiplier.
    expect(rig.weight("expr.jawOpen")).toBe(0.5)
  })

  test("weights sent already scaled reach the mesh as they are; expressions are still multiplied", () => {
    const { scene, mesh, animations } = scaledModel()
    const rig = createModelRig({ scene, animations })
    rig.setWeights(new Float32Array([0.5, 0.008]), undefined, true, true)
    expect(influence(mesh, "body.pc00")).toBe(0.5)
    expect(influence(mesh, "expr.jawOpen")).toBeCloseTo(0.008, 7)
    expect(rig.weight("expr.jawOpen")).toBeCloseTo(0.8, 6)
    rig.setWeights({ "body.pc00": 0.25 }, { jawOpen: 1 }, true, true)
    expect(influence(mesh, "body.pc00")).toBe(0.25)
    expect(influence(mesh, "expr.jawOpen")).toBeCloseTo(0.01, 7)
  })

  test("without valid scales, weights reach the mesh as they are", () => {
    for (const scales of [null, [1], [1, "2"], [1, Number.NaN]]) {
      const { scene, mesh, animations } = scaledModel(scales)
      createModelRig({ scene, animations }).setWeights({ "expr.jawOpen": 0.4 }, undefined, true)
      expect(influence(mesh, "expr.jawOpen")).toBeCloseTo(0.4, 6)
    }
  })

  test("writeTargets divides scaled weights back, and a zero scale moves nothing", () => {
    const index = new Map([
      ["a", 0],
      ["b", 1],
    ])
    const target = new Float32Array(2)
    const active = new Uint8Array(2)
    writeTargets(index, target, active, [0.5, 3], undefined, new Float32Array([0.25, 0]))
    expect([...target]).toEqual([2, 0])
    expect([...active]).toEqual([1, 1])
  })

  test("a copy sharing a mesh's influences (an outline hull) doesn't undo its scale", () => {
    const { scene, mesh, animations } = scaledModel()
    const hull = mesh.clone(false)
    hull.morphTargetInfluences = mesh.morphTargetInfluences
    hull.userData = {}
    mesh.parent?.add(hull)
    createModelRig({ scene, animations }).setWeights({ "expr.jawOpen": 1 }, undefined, true)
    expect(influence(hull, "expr.jawOpen")).toBeCloseTo(0.01, 7)
  })
})

describe("the demo character", () => {
  test("23 scaled targets, idle and wave, its own weights, and both styles alike but for their materials", async () => {
    const soft = await loadCharacter()
    const cel = await loadCharacter("character-cel-outline.glb")
    const rig = createModelRig(soft)
    expect(rig.morphNames).toEqual(recording.targetNames)
    expect(rig.clipNames).toEqual(["idle", "wave"])
    const body = soft.scene.getObjectByName("body") as SkinnedMesh & { morphTargetInfluences: number[] }
    expect(body.userData.targetScales).toEqual(recording.targetScales)
    const done = recording.events.find((event) => event.type === "done")
    if (done?.type !== "done") throw new Error("The recording has no done event.")
    // The GLB starts on the scanned character's weights, scaled like the recording's.
    for (const [i, weight] of done.character.weights.entries())
      expect(body.morphTargetInfluences[i]).toBeCloseTo(weight, 5)
    // The same meshes and targets; the cel style's colours are a little more saturated.
    expect(shape(createModelRig(cel).signature)).toBe(shape(rig.signature))
    const style = (scene: typeof soft.scene) =>
      ((scene.getObjectByName("body") as Mesh).material as MeshStandardMaterial).userData.eskais.style.id
    expect([style(soft.scene), style(cel.scene)]).toEqual(["soft-toon", "cel-outline"])
  })

  test("the recording's last weights, sent as scaledWeights, land on the mesh as recorded", async () => {
    const model = await loadCharacter()
    const rig = createModelRig(model)
    const done = recording.events.find((event) => event.type === "done")
    if (done?.type !== "done") throw new Error("The recording has no done event.")
    const body = model.scene.getObjectByName("body") as SkinnedMesh & { morphTargetInfluences: number[] }
    body.morphTargetInfluences.fill(0)
    rig.setWeights(Float32Array.from(done.character.weights), { mouthSmileLeft: 1 }, true, true)
    for (const [i, weight] of done.character.weights.entries()) {
      if (recording.targetNames[i] === "expr.mouthSmileLeft") continue
      expect(body.morphTargetInfluences[i]).toBeCloseTo(weight, 6)
    }
    const smile = recording.targetNames.indexOf("expr.mouthSmileLeft")
    expect(body.morphTargetInfluences[smile]).toBeCloseTo(recording.targetScales[smile] ?? 0, 6)
  })
})

/** A handle that records what the rig hook reports. */
function hookHandle() {
  const api = { loading: vi.fn(), loaded: vi.fn(), failed: vi.fn() }
  return { handle: { api, get: () => ({}), subscribe: () => () => {} } as unknown as ModelViewerHandle, api }
}

describe("onModelLoad", () => {
  test("runs once per model, before its rig exists, and what it returns runs when the model goes", async () => {
    const { handle, api } = hookHandle()
    const order: string[] = []
    const cleanup = vi.fn()
    const restyled = new MeshStandardMaterial({ name: "restyled" })
    const onModelLoad = vi.fn((scene: Object3D) => {
      order.push("onModelLoad")
      ;(scene.children[0] as Mesh).material = restyled
      return cleanup
    })
    api.loaded.mockImplementation(() => order.push("loaded"))
    const first = scaledModel()
    const { result, rerender, unmount } = renderHook(
      ({ source }) => useModelRig(source, handle, undefined, undefined, onModelLoad),
      { initialProps: { source: first } },
    )
    await waitFor(() => expect(result.current.rig).not.toBeNull())
    expect(order).toEqual(["onModelLoad", "loaded"])
    expect(onModelLoad).toHaveBeenCalledWith(first.scene, [])
    // The rig takes the restyled materials as the model's own: "standard" puts them back after the toon swap.
    const rig = result.current.rig
    rig?.setMaterial("toon")
    rig?.setMaterial("standard")
    expect(first.mesh.material).toBe(restyled)
    rerender({ source: first })
    await act(async () => {})
    expect(onModelLoad).toHaveBeenCalledOnce()

    const second = scaledModel()
    rerender({ source: second })
    await waitFor(() => expect(onModelLoad).toHaveBeenCalledTimes(2))
    unmount()
    expect(cleanup).toHaveBeenCalledTimes(2)
  })

  test("a promise holds the model back until it resolves", async () => {
    const { handle } = hookHandle()
    const pending = Promise.withResolvers<() => void>()
    const cleanup = vi.fn()
    const onModelLoad = vi.fn(() => pending.promise)
    const source = scaledModel()
    const { result, unmount } = renderHook(() => useModelRig(source, handle, undefined, undefined, onModelLoad))
    await waitFor(() => expect(onModelLoad).toHaveBeenCalledOnce())
    await act(async () => {})
    expect(result.current.rig).toBeNull()
    await act(async () => pending.resolve(cleanup))
    expect(result.current.rig).not.toBeNull()
    unmount()
    expect(cleanup).toHaveBeenCalledOnce()
  })

  test("a throw fails the load like a broken file", async () => {
    const { handle, api } = hookHandle()
    const onError = vi.fn()
    const source = scaledModel()
    renderHook(() =>
      useModelRig(source, handle, undefined, onError, () => {
        throw new Error("The style didn't build.")
      }),
    )
    await waitFor(() => expect(api.failed).toHaveBeenCalledOnce())
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "The style didn't build." }))
  })
})

describe("the scan replay", () => {
  test("replays the recorded events at their times, slowed down, and stops on abort", async () => {
    vi.useFakeTimers()
    const seen: { type: string; at: number }[] = []
    const start = Date.now()
    const done = replayScan(recording, (event) => seen.push({ type: event.type, at: Date.now() - start }), {
      glb: (file) => `/assets/${file}`,
      slowdown: 10,
    })
    await vi.runAllTimersAsync()
    await done
    expect(seen).toHaveLength(recording.events.length)
    expect(seen.map((event) => event.at)).toEqual(recording.events.map((event) => event.at * 10))

    const controller = new AbortController()
    const events: string[] = []
    const run = replayScan(recording, (event) => events.push(event.type), {
      glb: (file) => file,
      slowdown: 10,
      signal: controller.signal,
    }).catch((error: unknown) => error)
    await vi.advanceTimersByTimeAsync(1000)
    controller.abort()
    expect(await run).toMatchObject({ name: "AbortError" })
    await vi.runAllTimersAsync()
    expect(events).not.toContain("model")
    vi.useRealTimers()
  })

  test("maps through toModelScanProps: every stage in order, the real landmarks, the GLB's URL, the scaled weights", async () => {
    vi.useFakeTimers()
    let state = idleScan
    const stages: string[] = []
    replayScan(
      recording,
      (event: ScanEvent) => {
        state = reduceScan(state, event)
        const stage = scanStage(state)
        if (stages.at(-1) !== stage) stages.push(stage)
      },
      { glb: (file) => `/assets/${file}` },
    )
    await vi.runAllTimersAsync()
    vi.useRealTimers()
    expect(stages).toEqual(["detecting", "building", "refining", "ready"])
    const props = toModelScanProps(state)
    const done = recording.events.find((event) => event.type === "done")
    if (done?.type !== "done") throw new Error("The recording has no done event.")
    expect(props).toMatchObject({
      stage: "ready",
      model: { glb: "/assets/character-soft-toon.glb" },
      scaledWeights: true,
      progress: undefined,
    })
    expect([...(props.weights as Float32Array)]).toEqual([...Float32Array.from(done.character.weights)])
    expect(state.landmarks.map((group) => [group.source, group.points.length])).toEqual([
      ["face", 956],
      ["body", 66],
    ])
    // Refining shows the engine's progress.
    const refining = reduceScan(reduceScan(idleScan, { type: "model", glb: "a.glb", targetNames: [] }), {
      type: "progress",
      value: 0.5,
      weights: new Float32Array(23),
    })
    expect(toModelScanProps(refining)).toMatchObject({ stage: "refining", progress: 0.5 })
  })

  test("the face's landmarks land on the body photo, within 3 px of the body's own at the shared features", () => {
    const groups = recording.events.flatMap((event) =>
      event.type === "landmarks"
        ? [{ type: event.type, source: event.source, aspect: event.aspect, points: Float32Array.from(event.points) }]
        : [],
    )
    const [face, body] = groups
    if (!face || !body) throw new Error("The recording has no landmarks.")
    const placed = placeFaceOnBody(face, body)
    // Pixels of the 540 × 960 body photo: the face mesh's nose tip is the sample's 34th point, the pose's nose its first.
    const dx = (placed[33 * 2] ?? 0) - (body.points[0] ?? 0)
    const dy = (placed[33 * 2 + 1] ?? 0) - (body.points[1] ?? 0)
    expect(Math.hypot(dx * 540, dy * 960)).toBeLessThan(4)
    for (let i = 0; i < placed.length; i += 1) expect(placed[i]).toBeGreaterThan(0)
    const drawn = onBodyPhoto(recording)(groups)
    expect(drawn.map((group) => [group.source, group.aspect])).toEqual([
      ["face", body.aspect],
      ["body", body.aspect],
    ])
    expect(onBodyPhoto({ ...recording, events: [] })(groups).map((group) => group.source)).toEqual(["body"])
  })
})
