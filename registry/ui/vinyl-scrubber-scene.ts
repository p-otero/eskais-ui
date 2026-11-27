import {
  ACESFilmicToneMapping,
  BoxGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  CircleGeometry,
  CylinderGeometry,
  DirectionalLight,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShadowMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Texture,
  TubeGeometry,
  Vector3,
  WebGLRenderer,
  type BufferGeometry,
  type Material,
} from "three"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"

import {
  armAngle,
  cameraFovDegrees,
  cameraPosition,
  cameraTarget,
  deckTop,
  labelRadius,
  recordCenter,
  recordRadius,
  recordTurn,
} from "@/components/ui/vinyl-scrubber-view"
import { grilleHoles, grooves, tangents } from "@/components/ui/vinyl-scrubber-textures"
import {
  disposeAll,
  isSoftwareRenderer,
  prepareScene,
  stagePixelRatio,
  studioEnvironment,
  type StageSize,
} from "@/lib/three-studio"
import { canvasTexture, isBitmap, noise, repeating, type Surface } from "@/lib/three-textures"

type LabelImage = Surface | ImageBitmap

type TurntableScene = {
  /** Whether WebGL runs on the CPU (SwiftShader, llvmpipe, WARP), where every frame is costly. */
  software: boolean
  /** Resolves once the shaders have compiled off the GPU's main thread and the textures are uploaded. */
  prepare: () => Promise<void>
  setSize: (size: StageSize) => void
  /** A label drawn upside down (the texture isn't flipped on upload, so a bitmap and a canvas read the same). */
  setLabel: (image: LabelImage) => void
  render: (seconds: number, progress: number) => void
  dispose: () => void
}

const shadowRedrawRadians = 0.004

function materials() {
  const leatherBump = repeating(
    canvasTexture(512, (c, s) => noise(c, s, 128, 90, true, 7), false),
    3,
  )
  const leatherRough = repeating(
    canvasTexture(256, (c, s) => noise(c, s, 200, 50, false, 11), false),
    4,
  )
  const grilleAlpha = repeating(canvasTexture(256, grilleHoles, false), 3)
  return {
    leather: new MeshPhysicalMaterial({
      color: 0x0d0d0f,
      roughness: 0.55,
      roughnessMap: leatherRough,
      bumpMap: leatherBump,
      bumpScale: 0.6,
      sheen: 0.15,
      sheenColor: 0x50505a,
      sheenRoughness: 0.5,
    }),
    fabric: new MeshStandardMaterial({
      color: 0x0b0b0d,
      roughness: 0.95,
      bumpMap: leatherBump,
      bumpScale: 0.25,
    }),
    chrome: new MeshStandardMaterial({
      color: 0xe6e8ec,
      metalness: 1,
      roughness: 0.16,
    }),
    brushed: new MeshPhysicalMaterial({
      color: 0xb9bdc3,
      metalness: 1,
      roughness: 0.3,
      anisotropy: 0.7,
    }),
    plastic: new MeshPhysicalMaterial({
      color: 0x0c0c0e,
      roughness: 0.35,
      clearcoat: 0.4,
      clearcoatRoughness: 0.3,
    }),
    rubber: new MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 }),
    grille: new MeshStandardMaterial({
      color: 0x3a3b40,
      metalness: 0.3,
      roughness: 0.55,
      alphaMap: grilleAlpha,
      alphaTest: 0.5,
    }),
    vinyl: new MeshPhysicalMaterial({
      color: 0x060607,
      roughness: 0.32,
      metalness: 0,
      anisotropy: 1,
      anisotropyMap: canvasTexture(256, tangents, false),
      bumpMap: canvasTexture(2048, grooves, false),
      bumpScale: 0.35,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      iridescence: 0.35,
      iridescenceIOR: 1.6,
      iridescenceThicknessRange: [250, 900],
    }),
    cartridge: new MeshPhysicalMaterial({
      color: 0xd62a1c,
      roughness: 0.3,
      clearcoat: 0.6,
    }),
    label: new MeshStandardMaterial({ color: 0xd91f10, roughness: 0.6 }),
  }
}

type Materials = ReturnType<typeof materials>

function part(geometry: BufferGeometry, material: Material, x = 0, y = 0, z = 0) {
  const mesh = new Mesh(geometry, material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.position.set(x, y, z)
  return mesh
}

function flat(geometry: BufferGeometry, material: Material, y: number, facingUp = true) {
  const mesh = part(geometry, material, 0, y, 0)
  mesh.rotation.x = facingUp ? -Math.PI / 2 : Math.PI / 2
  return mesh
}

const caseWidth = 36
const caseDepth = 27
const caseHeight = 11

function suitcase(m: Materials) {
  const group = new Group()
  group.add(part(new RoundedBoxGeometry(caseWidth, caseHeight, caseDepth, 6, 0.9), m.leather, 0, caseHeight / 2 + 0.6))
  group.add(part(new BoxGeometry(caseWidth - 2.6, 0.4, caseDepth - 2.6), m.fabric, 0, caseHeight + 0.45))
  const lid = new Group()
  lid.position.set(0, caseHeight + 0.6, -caseDepth / 2 - 0.3)
  lid.rotation.x = -1.68
  lid.add(part(new RoundedBoxGeometry(caseWidth, 4, caseDepth, 6, 0.9), m.leather, 0, 2, caseDepth / 2 - 0.3))
  lid.add(part(new BoxGeometry(caseWidth - 2.4, 0.2, caseDepth - 2.4), m.fabric, 0, -0.05, caseDepth / 2 - 0.3))
  group.add(lid)
  for (const x of [-caseWidth / 2 + 0.5, caseWidth / 2 - 0.5]) {
    const foot = part(new SphereGeometry(1.15, 24, 16), m.chrome, x, 1.6, caseDepth / 2 - 0.5)
    foot.scale.set(1, 1.1, 1)
    group.add(foot)
  }
  for (const x of [-caseWidth / 2 + 3, caseWidth / 2 - 3]) {
    for (const z of [-caseDepth / 2 + 3, caseDepth / 2 - 3]) {
      group.add(part(new CylinderGeometry(0.9, 1, 0.6, 24), m.rubber, x, 0.3, z))
    }
  }
  for (const x of [-11.5, 11.5]) {
    group.add(part(new PlaneGeometry(8.5, 6.5), m.grille, x, caseHeight / 2 + 0.6, caseDepth / 2 + 0.03))
  }
  for (const x of [-6.5, 6.5]) {
    group.add(part(new RoundedBoxGeometry(3.4, 2, 0.9, 3, 0.35), m.chrome, x, caseHeight - 1.6, caseDepth / 2 + 0.3))
  }
  group.add(part(new RoundedBoxGeometry(2.2, 2.6, 0.8, 3, 0.3), m.chrome, 0, caseHeight - 0.8, caseDepth / 2 + 0.3))
  const front = caseDepth / 2
  const handle = new CatmullRomCurve3([
    new Vector3(-6.5, caseHeight - 2.4, front + 0.6),
    new Vector3(-5.6, caseHeight - 5.6, front + 1.8),
    new Vector3(0, caseHeight - 6.4, front + 2.2),
    new Vector3(5.6, caseHeight - 5.6, front + 1.8),
    new Vector3(6.5, caseHeight - 2.4, front + 0.6),
  ])
  group.add(part(new TubeGeometry(handle, 48, 0.75, 16), m.leather))
  return group
}

function platter(m: Materials) {
  const group = new Group()
  const { x, z } = recordCenter
  group.add(part(new CylinderGeometry(9.6, 9.6, 1.2, 96), m.brushed, x, deckTop + 0.6, z))
  group.add(part(new CylinderGeometry(9.3, 9.3, 0.15, 96), m.rubber, x, deckTop + 1.25, z))
  group.add(part(new CylinderGeometry(0.3, 0.3, 1.3, 24), m.chrome, x, deckTop + 1.9, z))
  return group
}

function record(m: Materials) {
  const group = new Group()
  group.position.copy(recordCenter)
  group.add(part(new CylinderGeometry(recordRadius, recordRadius, 0.18, 160, 1, true), m.vinyl))
  group.add(flat(new CircleGeometry(recordRadius, 160), m.vinyl, 0.09))
  group.add(flat(new CircleGeometry(recordRadius, 96), m.vinyl, -0.09, false))
  group.add(flat(new CircleGeometry(labelRadius, 96), m.label, 0.1))
  return group
}

const pivot = { x: 12.5, z: -6 }
const armLength = 19.5

function tonearm(m: Materials) {
  const base = new Group()
  base.add(part(new CylinderGeometry(2.4, 2.7, 1, 48), m.plastic, pivot.x, deckTop + 0.5, pivot.z))
  base.add(part(new CylinderGeometry(1.1, 1.3, 2.6, 32), m.plastic, pivot.x, deckTop + 2.2, pivot.z))
  base.add(part(new CylinderGeometry(0.5, 0.5, 2.4, 16), m.plastic, 15.5, deckTop + 1.2, 6))
  for (const x of [14, 10.5]) base.add(part(new CylinderGeometry(0.9, 0.9, 1, 32), m.brushed, x, deckTop + 0.5, 10.5))
  const arm = new Group()
  arm.position.set(pivot.x, deckTop + 3.2, pivot.z)
  arm.rotation.x = 0.06
  const tube = part(new CylinderGeometry(0.32, 0.32, armLength, 24), m.plastic, 0, 0, armLength / 2 - 3.5)
  tube.rotation.x = Math.PI / 2
  arm.add(tube)
  const counterweight = part(new CylinderGeometry(1.15, 1.15, 2.4, 32), m.plastic, 0, 0, -4.4)
  counterweight.rotation.x = Math.PI / 2
  arm.add(counterweight)
  const head = new Group()
  head.position.set(0, -0.9, armLength - 3.5)
  head.rotation.y = -0.38
  head.add(part(new RoundedBoxGeometry(2.1, 0.5, 3.6, 3, 0.18), m.plastic, 0, 0.6, 0.8))
  head.add(part(new RoundedBoxGeometry(1.5, 1, 2, 3, 0.2), m.cartridge, 0, -0.15, 1))
  head.add(part(new BoxGeometry(0.4, 0.2, 1.6), m.chrome, 1.4, 0.6, -0.2))
  arm.add(head)
  base.add(arm)
  return { base, arm }
}

function lights(scene: Scene) {
  const key = new DirectionalLight(0xfff3e6, 1.6)
  key.position.set(-25, 80, 30)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  key.shadow.camera.left = -40
  key.shadow.camera.bottom = -40
  key.shadow.camera.right = 40
  key.shadow.camera.top = 40
  key.shadow.radius = 6
  key.shadow.bias = -0.0004
  const rim = new DirectionalLight(0xcfe0ff, 1.2)
  rim.position.set(40, 30, -50)
  scene.add(key, rim)
}

/** The suitcase turntable in a dark studio, drawn into `canvas`; it throws when the canvas has no WebGL. */
function createTurntableScene(canvas: Surface, size: StageSize): TurntableScene {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true })
  const software = isSoftwareRenderer(renderer)
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFShadowMap
  renderer.shadowMap.autoUpdate = false

  const scene = new Scene()
  const environment = studioEnvironment(renderer)
  scene.environment = environment.texture

  const m = materials()
  const turntable = new Group()
  const disc = record(m)
  const { base, arm } = tonearm(m)
  turntable.add(suitcase(m), platter(m), disc, base)
  const floor = new Mesh(new PlaneGeometry(400, 400), new ShadowMaterial({ opacity: 0.45 }))
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(turntable, floor)
  lights(scene)

  const camera = new PerspectiveCamera(cameraFovDegrees, 1, 1, 1000)
  camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z)
  camera.lookAt(cameraTarget.x, cameraTarget.y, cameraTarget.z)

  let shadowArm = Number.NaN
  let label: Texture | null = null

  const setSize = ({ width, height, pixelRatio }: StageSize) => {
    renderer.setPixelRatio(stagePixelRatio(software, pixelRatio))
    renderer.setSize(Math.max(1, width), Math.max(1, height), false)
    camera.aspect = width > 0 && height > 0 ? width / height : 1
    camera.updateProjectionMatrix()
    shadowArm = Number.NaN
  }
  setSize(size)

  return {
    software,
    prepare: () => prepareScene(renderer, scene, camera),
    setSize,
    setLabel(image) {
      const previous = label
      label = isBitmap(image) ? new Texture(image) : new CanvasTexture(image)
      label.flipY = false
      label.colorSpace = SRGBColorSpace
      label.anisotropy = 8
      label.needsUpdate = true
      m.label.map = label
      m.label.color.set(0xffffff)
      m.label.needsUpdate = true
      if (isBitmap(previous?.image)) previous.image.close()
      previous?.dispose()
    },
    render(seconds, progress) {
      disc.rotation.y = -recordTurn(seconds)
      arm.rotation.y = armAngle(progress)
      if (!(Math.abs(arm.rotation.y - shadowArm) < shadowRedrawRadians)) {
        shadowArm = arm.rotation.y
        renderer.shadowMap.needsUpdate = true
      }
      renderer.render(scene, camera)
    },
    dispose() {
      if (isBitmap(label?.image)) label.image.close()
      disposeAll(scene)
      environment.dispose()
      renderer.dispose()
    },
  }
}

export { createTurntableScene }
export type { LabelImage, StageSize, TurntableScene }
