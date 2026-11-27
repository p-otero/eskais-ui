import {
  ACESFilmicToneMapping,
  BoxGeometry,
  CapsuleGeometry,
  CircleGeometry,
  CylinderGeometry,
  DirectionalLight,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Scene,
  ShadowMaterial,
  TorusGeometry,
  WebGLRenderer,
  type BufferGeometry,
  type Material,
} from "three"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"

import { materials, roundedRect, sized, studio, type Materials } from "@/components/ui/safe-vault-materials"
import { contactShadow, dialFace } from "@/components/ui/safe-vault-textures"
import {
  backInside,
  bodyCenterY,
  boltCount,
  cameraFovDegrees,
  cameraPosition,
  ceilingInside,
  depth,
  dialOnDoor,
  doorCenter,
  doorDepth,
  doorFrontZ,
  doorHeight,
  doorWidth,
  floorInside,
  framingFor,
  height,
  lift,
  liningFront,
  openingHeight,
  openingWidth,
  panelDepth,
  panelFace,
  panelRows,
  panelSeam,
  pivot,
  plaqueFace,
  plaqueRowCenter,
  plaqueWidth,
  screwInset,
  width,
} from "@/components/ui/safe-vault-view"
import { poseAt, type Pose, type SafeVaultMotion } from "@/components/ui/safe-vault-timeline"
import {
  disposeAll,
  isSoftwareRenderer,
  prepareScene,
  stagePixelRatio,
  studioEnvironment,
  type StageSize,
} from "@/lib/three-studio"
import { canvasTexture, type Surface } from "@/lib/three-textures"

/**
 * What the vault draws: its motion, the dial's turn in degrees and how many numbers it carries, the plaque's height in
 * centimetres, and whether it may move on its own (in view, without reduced motion).
 */
type VaultState = {
  motion: SafeVaultMotion
  dialDegrees: number
  numbers: number
  plaqueHeight: number
  moving: boolean
}

type VaultScene = {
  software: boolean
  prepare: () => Promise<void>
  setSize: (size: StageSize) => void
  render: (state: VaultState, now: number) => void
  dispose: () => void
}

const environmentCubeSize = 128
const shadowMapSize = 512
const boltLockedX = 0.4
const boltRetractedX = 2.7
const warmLightCandela = 9000

function part(geometry: BufferGeometry, material: Material | Material[], x = 0, y = 0, z = 0) {
  const mesh = new Mesh(geometry, material)
  mesh.castShadow = true
  mesh.position.set(x, y, z)
  return mesh
}

function facing(mesh: Mesh) {
  mesh.rotation.x = Math.PI / 2
  return mesh
}

function boltHeights() {
  const span = doorHeight - 18
  return Array.from({ length: boltCount }, (_, index) => -span / 2 + (span * index) / (boltCount - 1))
}

const hingeHeights = [openingHeight / 2 - 12, -openingHeight / 2 + 12]

function body(m: Materials) {
  const group = new Group()
  const bevel = 0.8
  const outline = roundedRect(width - bevel * 2, height - bevel * 2, 2.6)
  outline.holes.push(roundedRect(openingWidth + bevel * 2, openingHeight + bevel * 2, 0.6))
  const extruded = new ExtrudeGeometry(outline, {
    depth: depth - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 4,
    curveSegments: 10,
  })
  group.add(part(extruded, [m.steel, m.steel], 0, bodyCenterY, bevel))
  group.add(
    part(new BoxGeometry(openingWidth + 1, openingHeight + 1, backInside), m.jamb, 0, bodyCenterY, backInside / 2),
  )
  for (const x of [-width / 2 + 5, width / 2 - 5]) {
    for (const z of [5, depth - 5]) group.add(part(new CylinderGeometry(2.2, 2.4, lift, 24), m.rubber, x, lift / 2, z))
  }
  for (const y of boltHeights()) {
    const hole = new Mesh(new CircleGeometry(1.7, 32), m.hole)
    hole.rotation.y = Math.PI / 2
    hole.position.set(-openingWidth / 2 + 0.02, bodyCenterY + y, doorFrontZ - doorDepth / 2)
    group.add(hole)
  }
  for (const y of hingeHeights) {
    group.add(part(new CylinderGeometry(1.6, 1.6, 10, 32), m.hinge, pivot.x, bodyCenterY + y, pivot.z))
    for (const end of [-1, 1]) {
      group.add(part(new CylinderGeometry(0.9, 1.6, 1.2, 32), m.hinge, pivot.x, bodyCenterY + y + end * 5.6, pivot.z))
    }
    group.add(part(new BoxGeometry(0.4, 7, 4), m.steelBox, width / 2 + 0.2, bodyCenterY + y, depth - 1.2))
  }
  return group
}

function interior(m: Materials) {
  const group = new Group()
  const inset = 0.05
  const w = openingWidth - inset * 2
  const h = openingHeight - inset * 2
  const d = liningFront - backInside
  const midZ = backInside + d / 2
  const plane = (pw: number, ph: number, x: number, y: number, z: number, rx: number, ry: number) => {
    const mesh = new Mesh(new PlaneGeometry(pw, ph), m.felt)
    mesh.position.set(x, y, z)
    mesh.rotation.set(rx, ry, 0)
    group.add(mesh)
  }
  plane(d, h, -w / 2, bodyCenterY, midZ, 0, Math.PI / 2)
  plane(d, h, w / 2, bodyCenterY, midZ, 0, -Math.PI / 2)
  plane(w, d, 0, ceilingInside - inset, midZ, Math.PI / 2, 0)
  plane(w, d, 0, floorInside + inset, midZ, -Math.PI / 2, 0)
  const back = new Mesh(new PlaneGeometry(w, h), m.seam)
  back.position.set(0, bodyCenterY, backInside + inset)
  group.add(back)
  let rowBottom = floorInside + inset
  for (const [row, rowHeight] of panelRows.entries()) {
    const columns = row === 1 ? 1 : 2
    const tileWidth = w / columns
    for (let column = 0; column < columns; column++) {
      const tile = new Mesh(
        new RoundedBoxGeometry(tileWidth - panelSeam, rowHeight - panelSeam, panelDepth, 2, 0.15),
        m.panel,
      )
      tile.position.set(-w / 2 + tileWidth * (column + 0.5), rowBottom + rowHeight / 2, panelFace - panelDepth / 2)
      group.add(tile)
    }
    rowBottom += rowHeight
  }
  group.add(part(new BoxGeometry(openingWidth - 8, 0.35, 1.2), m.led, 0, ceilingInside - 0.3, liningFront - 1.2))
  const screws = [-1, 1].flatMap((x) =>
    [-1, 1].map((y) => {
      const screw = facing(part(new CylinderGeometry(0.55, 0.6, 0.5, 24), m.satin))
      screw.userData = { x, y }
      group.add(screw)
      return screw
    }),
  )
  const placeScrews = (plaqueHeight: number) => {
    for (const screw of screws) {
      const { x = 0, y = 0 } = screw.userData
      screw.position.set(
        Number(x) * (plaqueWidth / 2 - screwInset),
        plaqueRowCenter + Number(y) * (plaqueHeight / 2 - screwInset),
        plaqueFace,
      )
    }
  }
  return { group, placeScrews }
}

function dial(m: Materials) {
  const group = new Group()
  group.add(facing(part(new CylinderGeometry(9.4, 9.8, 0.9, 96), m.chrome, 0, 0, 0.45)))
  group.add(part(new TorusGeometry(9.15, 0.35, 16, 96), m.chrome, 0, 0, 0.9))
  group.add(part(new BoxGeometry(0.7, 1.6, 0.6), m.hole, 0, 8.55, 1.1))
  const rotor = new Group()
  rotor.add(facing(part(new CylinderGeometry(8, 8.1, 1.6, 128, 1, true), m.knurled, 0, 0, 1.75)))
  rotor.add(part(new CircleGeometry(8, 128), m.face, 0, 0, 2.56))
  rotor.add(facing(part(new CylinderGeometry(3.4, 3.6, 3.2, 64, 1, true), m.knurled, 0, 0, 4.15)))
  rotor.add(part(new CircleGeometry(3.4, 64), m.satin, 0, 0, 5.76))
  rotor.add(part(new TorusGeometry(3.3, 0.18, 12, 64), m.chrome, 0, 0, 5.7))
  group.add(rotor)
  group.position.set(dialOnDoor.x, dialOnDoor.y, dialOnDoor.z)
  return { group, rotor }
}

function door(m: Materials) {
  const group = new Group()
  group.position.set(pivot.x, pivot.y, pivot.z)
  const bevel = 0.7
  const slab = new ExtrudeGeometry(roundedRect(doorWidth - bevel * 2, doorHeight - bevel * 2, 1.4), {
    depth: doorDepth - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 4,
    curveSegments: 10,
  })
  group.add(part(slab, [m.steel, m.steel], doorCenter.x, doorCenter.y, doorCenter.z - doorDepth / 2 + bevel))
  const backFace = doorCenter.z - doorDepth / 2
  group.add(
    part(
      new RoundedBoxGeometry(doorWidth - 9, doorHeight - 9, 1, 3, 0.4),
      m.doorInner,
      doorCenter.x,
      0,
      backFace - 0.3,
    ),
  )
  for (const x of [-1, 1]) {
    for (const y of [-1, 1]) {
      const screw = part(
        new CylinderGeometry(0.6, 0.6, 0.4, 16),
        m.satin,
        doorCenter.x + x * (doorWidth / 2 - 7),
        y * (doorHeight / 2 - 7),
        backFace - 0.9,
      )
      group.add(facing(screw))
    }
  }
  const bolts = boltHeights().map((y) => {
    const bolt = part(
      new CapsuleGeometry(1.6, 4, 8, 24),
      m.chrome,
      doorCenter.x - doorWidth / 2 + boltLockedX,
      y,
      doorCenter.z,
    )
    bolt.rotation.z = Math.PI / 2
    group.add(bolt)
    return bolt
  })
  for (const y of hingeHeights)
    group.add(part(new BoxGeometry(4.6, 7, 0.4), m.steelBox, -3.3, y, doorFrontZ - pivot.z + 0.2))
  const { group: dialGroup, rotor } = dial(m)
  group.add(dialGroup)
  return { group, bolts, rotor }
}

function floorShadows() {
  const floor = new Mesh(new PlaneGeometry(600, 600), new ShadowMaterial({ opacity: 0.3 }))
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  const contact = canvasTexture(sized("contactShadow"), contactShadow, false)
  const blob = new Mesh(
    new PlaneGeometry(width * 1.5, depth * 1.5),
    new MeshBasicMaterial({
      color: 0x000000,
      alphaMap: contact,
      transparent: true,
      depthWrite: false,
    }),
  )
  blob.rotation.x = -Math.PI / 2
  blob.position.set(0, 0.05, depth / 2)
  return [floor, blob]
}

function lights(scene: Scene) {
  const key = new DirectionalLight(0xfff3e6, 2.4)
  key.position.set(-70, 220, 110)
  key.target.position.set(0, 30, 30)
  key.castShadow = true
  key.shadow.mapSize.set(shadowMapSize, shadowMapSize)
  Object.assign(key.shadow.camera, {
    left: -110,
    right: 110,
    top: 110,
    bottom: -110,
    near: 10,
    far: 500,
  })
  key.shadow.radius = 4
  key.shadow.bias = -0.0006
  key.shadow.normalBias = 0.4
  const rim = new DirectionalLight(0xcfe0ff, 1.8)
  rim.position.set(120, 80, -90)
  scene.add(key, key.target, rim)
}

const posed = (a: Pose, b: Pose | null) => b !== null && a.bolts === b.bolts && a.doorDegrees === b.doorDegrees

/** The safe in a dark studio, drawn into `canvas`; it throws when the canvas has no WebGL. */
function createVaultScene(canvas: Surface, size: StageSize): VaultScene {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true })
  const software = isSoftwareRenderer(renderer)
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.3
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFShadowMap
  renderer.shadowMap.autoUpdate = false

  const scene = new Scene()
  const environment = studioEnvironment(renderer, studio, environmentCubeSize)
  scene.environment = environment.texture

  const m = materials()
  const { group: doorGroup, bolts, rotor } = door(m)
  const { group: inside, placeScrews } = interior(m)
  scene.add(body(m), inside, doorGroup, ...floorShadows())
  lights(scene)
  const warm = new PointLight(0xffb468, 0, 0, 2)
  warm.position.set(0, ceilingInside - 4, liningFront - 5)
  scene.add(warm)

  const camera = new PerspectiveCamera(cameraFovDegrees, 1, 5, 2000)
  let stage = size
  let shadowPose: Pose | null = null
  let plaqueHeight = Number.NaN
  let numbers = 0

  const engraveDial = (count: number) => {
    numbers = count
    const previous = m.face.map
    const face = canvasTexture(sized("dialFace"), dialFace(count), true)
    m.face.map = face
    m.face.bumpMap = face
    m.face.needsUpdate = true
    previous?.dispose()
  }
  engraveDial(100)

  const setSize = (next: StageSize) => {
    stage = next
    renderer.setPixelRatio(stagePixelRatio(software, next.pixelRatio))
    renderer.setSize(Math.max(1, next.width), Math.max(1, next.height), false)
    camera.aspect = next.width > 0 && next.height > 0 ? next.width / next.height : 1
    camera.updateProjectionMatrix()
    shadowPose = null
  }
  setSize(size)

  return {
    software,
    prepare: () => prepareScene(renderer, scene, camera),
    setSize,
    render(state, now) {
      const pose = poseAt(state.motion, now)
      const framing = framingFor(pose, camera.aspect, stage.width)
      const position = cameraPosition(framing)
      camera.position.set(position.x, position.y, position.z)
      camera.lookAt(framing.target.x, framing.target.y, framing.target.z)
      rotor.rotation.z = (-(state.dialDegrees + pose.wobbleDegrees) * Math.PI) / 180
      const boltX = doorCenter.x - doorWidth / 2 + boltLockedX + (boltRetractedX - boltLockedX) * pose.bolts
      for (const bolt of bolts) bolt.position.x = boltX
      doorGroup.rotation.y = (pose.doorDegrees * Math.PI) / 180
      warm.intensity = pose.light * warmLightCandela
      m.led.emissiveIntensity = pose.light * 3
      if (state.numbers !== numbers) engraveDial(state.numbers)
      if (state.plaqueHeight !== plaqueHeight) {
        plaqueHeight = state.plaqueHeight
        placeScrews(plaqueHeight)
      }
      if (!posed(pose, shadowPose)) {
        shadowPose = pose
        renderer.shadowMap.needsUpdate = true
      }
      renderer.render(scene, camera)
    },
    dispose() {
      disposeAll(scene)
      environment.dispose()
      renderer.dispose()
    },
  }
}

export { createVaultScene, environmentCubeSize, shadowMapSize }
export type { VaultScene, VaultState }
