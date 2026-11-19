// The demo figure in code: a GLB with engine-style targets (body.pcNN, face.<modifier>.incr|decr, expr.<ARKit>) and
// Idle and Wave clips, the same figure with other hair as the final character, its front "photo" as an SVG where the
// viewer's front camera sees it, and the face and body points a detector would report.
// Usage: bun tooling/generate-model-fixture.ts (writes test/fixtures/model/)
import { mkdirSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"

import {
  AnimationClip,
  Box3,
  BufferAttribute,
  BufferGeometry,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  NumberKeyframeTrack,
  Quaternion,
  QuaternionKeyframeTrack,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  VectorKeyframeTrack,
} from "three"
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js"
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js"

import { fieldOfView, fitBoxDistance, viewSizeAt } from "../registry/ui/model-viewer-math"

const out = resolve(import.meta.dirname, "..", "test", "fixtures", "model")

const palette = {
  skin: "#f1c27d",
  hair: "#5a3825",
  finalHair: "#3a2418",
  shirt: "#2f9e8f",
  pants: "#34466b",
  shoes: "#2b2b33",
  eye: "#1f1f24",
  mouth: "#9c3b3b",
}

type Part = { name: string; geometry: BufferGeometry; color: string }

function colored({ geometry, color }: Part) {
  // Color parses the hex as sRGB into three's linear working space, which glTF's COLOR_0 expects.
  const tint = new Color(color)
  const count = geometry.getAttribute("position").count
  const colors = new Float32Array(count * 3)
  for (let index = 0; index < count; index += 1) colors.set([tint.r, tint.g, tint.b], index * 3)
  geometry.setAttribute("color", new BufferAttribute(colors, 3))
  geometry.deleteAttribute("uv")
  return geometry
}

const at = (geometry: BufferGeometry, x: number, y: number, z: number) => geometry.translate(x, y, z)

// Heights in metres, feet on the ground, facing +Z.
const head = { y: 1.56, radius: 0.15 }
const eyes = [-0.055, 0.055].map((x) => ({ x, y: 1.58, z: 0.135 }))
const mouth = { y: 1.49, z: 0.14 }

const bodyParts: Part[] = [
  ...[-0.1, 0.1].map((x) => ({
    name: "leg",
    geometry: at(new CapsuleGeometry(0.085, 0.72, 3, 10), x, 0.46, 0),
    color: palette.pants,
  })),
  ...[-0.1, 0.1].map((x) => ({
    name: "shoe",
    geometry: at(new SphereGeometry(0.1, 10, 6).scale(0.9, 0.5, 1.4), x, 0.04, 0.04),
    color: palette.shoes,
  })),
  {
    name: "torso",
    geometry: at(new CapsuleGeometry(0.2, 0.42, 4, 14).scale(1, 1, 0.75), 0, 1.11, 0),
    color: palette.shirt,
  },
  { name: "neck", geometry: at(new CylinderGeometry(0.055, 0.06, 0.12, 10), 0, 1.4, 0), color: palette.skin },
]

const headParts: Part[] = [
  { name: "head", geometry: at(new SphereGeometry(head.radius, 20, 14), 0, head.y, 0), color: palette.skin },
  {
    name: "hair",
    geometry: at(
      new SphereGeometry(head.radius * 1.07, 20, 7, 0, Math.PI * 2, 0, Math.PI * 0.42),
      0,
      head.y + 0.01,
      -0.01,
    ),
    color: palette.hair,
  },
  ...eyes.map((eye) => ({
    name: "eye",
    geometry: at(new SphereGeometry(0.022, 8, 6), eye.x, eye.y, eye.z),
    color: palette.eye,
  })),
  {
    name: "mouth",
    geometry: at(new TorusGeometry(0.04, 0.009, 5, 12, Math.PI).rotateZ(Math.PI), 0, mouth.y + 0.03, mouth.z),
    color: palette.mouth,
  },
]

/** One geometry from its parts, and which vertices each part named owns. */
function merge(parts: Part[]) {
  const ranges: Record<string, [number, number][]> = {}
  let offset = 0
  for (const part of parts) {
    const count = part.geometry.getAttribute("position").count
    ;(ranges[part.name] ??= []).push([offset, offset + count])
    offset += count
  }
  const geometry = mergeGeometries(parts.map(colored))
  if (!geometry) throw new Error("The parts could not be merged")
  const inPart = (names: string[], index: number) =>
    names.some((name) => (ranges[name] ?? []).some(([from, to]) => index >= from && index < to))
  return { geometry, inPart }
}

function morph(geometry: BufferGeometry, name: string, move: (point: Vector3, index: number) => void) {
  const positions = geometry.getAttribute("position") as BufferAttribute
  const values = new Float32Array(positions.array.length)
  const point = new Vector3()
  for (let index = 0; index < positions.count; index += 1) {
    point.fromBufferAttribute(positions, index)
    move(point, index)
    values.set([point.x, point.y, point.z], index * 3)
  }
  const attribute = new BufferAttribute(values, 3)
  attribute.name = name
  return attribute
}

const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0, name: "Figure" })

function morphMesh(name: string, geometry: BufferGeometry, targets: BufferAttribute[]) {
  geometry.morphAttributes.position = targets
  geometry.computeVertexNormals()
  const mesh = new Mesh(geometry, material)
  mesh.name = name
  mesh.morphTargetDictionary = Object.fromEntries(targets.map((target, index) => [target.name, index]))
  mesh.morphTargetInfluences = targets.map(() => 0)
  return mesh
}

const body = merge(bodyParts)
const bodyMesh = morphMesh("Body", body.geometry, [
  morph(body.geometry, "body.pc00", (point, index) => {
    if (!body.inPart(["torso", "leg"], index)) return
    point.x *= 1.28
    point.z *= 1.22
  }),
])

const headCenter = new Vector3(0, head.y, 0)
const face = merge(headParts)
const headMesh = morphMesh("Head", face.geometry, [
  morph(face.geometry, "face.head_size.incr", (point) => {
    point.sub(headCenter).multiplyScalar(1.16).add(headCenter)
  }),
  morph(face.geometry, "face.head_size.decr", (point) => {
    point.sub(headCenter).multiplyScalar(0.88).add(headCenter)
  }),
  // The figure's left is +X, as it faces +Z.
  ...([1, -1] as const).map((side) =>
    morph(face.geometry, `expr.mouthSmile${side === 1 ? "Left" : "Right"}`, (point, index) => {
      if (!face.inPart(["mouth"], index) || point.x * side < 0) return
      point.y += 18 * point.x * point.x - 0.003
      point.x *= 1.1
    }),
  ),
  ...([1, -1] as const).map((side) =>
    morph(face.geometry, `expr.eyeBlink${side === 1 ? "Left" : "Right"}`, (point, index) => {
      if (!face.inPart(["eye"], index) || point.x * side < 0) return
      const eye = eyes.reduce((a, b) => (Math.abs(a.x - point.x) < Math.abs(b.x - point.x) ? a : b))
      point.y = eye.y + (point.y - eye.y) * 0.12
    }),
  ),
])

const shoulder = { x: 0.27, y: 1.3 }
function arm(side: 1 | -1) {
  const sleeve = colored({
    name: "sleeve",
    geometry: at(new CapsuleGeometry(0.062, 0.42, 3, 8), 0, -0.25, 0),
    color: palette.shirt,
  })
  const hand = colored({
    name: "hand",
    geometry: at(new SphereGeometry(0.06, 8, 6), 0, -0.53, 0.01),
    color: palette.skin,
  })
  const geometry = mergeGeometries([sleeve, hand])
  if (!geometry) throw new Error("An arm could not be merged")
  geometry.computeVertexNormals()
  const mesh = new Mesh(geometry, material)
  mesh.name = side === 1 ? "ArmLeft" : "ArmRight"
  mesh.position.set(side * shoulder.x, shoulder.y, 0)
  mesh.rotation.z = side * 0.12
  return mesh
}
const armLeft = arm(1)
const armRight = arm(-1)

const figure = new Group()
figure.name = "Figure"
figure.add(bodyMesh, headMesh, armLeft, armRight)

const turn = (z: number, x = 0) => new Quaternion().setFromAxisAngle(new Vector3(x, 0, 1).normalize(), z).toArray()
const restLeft = turn(0.12)
const restRight = turn(-0.12)

function idle() {
  const times = [0, 0.6, 1.2, 1.8, 2.4]
  const blinkTimes = [0, 1.1, 1.18, 1.26, 2.4]
  return new AnimationClip("Idle", 2.4, [
    new VectorKeyframeTrack("Figure.position", times, [0, 0, 0, 0, 0.012, 0, 0, 0, 0, 0, 0.012, 0, 0, 0, 0]),
    new QuaternionKeyframeTrack("ArmLeft.quaternion", [0, 1.2, 2.4], [...restLeft, ...turn(0.18), ...restLeft]),
    new QuaternionKeyframeTrack("ArmRight.quaternion", [0, 1.2, 2.4], [...restRight, ...turn(-0.18), ...restRight]),
    new NumberKeyframeTrack(
      "Head.morphTargetInfluences",
      blinkTimes,
      blinkTimes.flatMap((time) => [0, 0, 0, 0, time === 1.18 ? 1 : 0, time === 1.18 ? 1 : 0]),
    ),
  ])
}

function wave() {
  const up = turn(-2.6)
  const left = turn(-2.85)
  const right = turn(-2.35)
  return new AnimationClip("Wave", 2.2, [
    new QuaternionKeyframeTrack(
      "ArmRight.quaternion",
      [0, 0.45, 0.75, 1.05, 1.35, 1.65, 2.2],
      [...restRight, ...up, ...left, ...right, ...left, ...up, ...restRight],
    ),
    new NumberKeyframeTrack(
      "Head.morphTargetInfluences",
      [0, 0.45, 1.65, 2.2],
      [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
    ),
  ])
}

const clips = [idle(), wave()]

// GLTFExporter writes binary output through FileReader, which Bun and Node lack.
globalThis.FileReader ??= class {
  result: ArrayBuffer | string | null = null
  onloadend: (() => void) | null = null
  readAsArrayBuffer(blob: Blob) {
    void blob.arrayBuffer().then((buffer) => {
      this.result = buffer
      this.onloadend?.()
    })
  }
  readAsDataURL(blob: Blob) {
    void blob.arrayBuffer().then((buffer) => {
      this.result = `data:${blob.type || "application/octet-stream"};base64,${Buffer.from(buffer).toString("base64")}`
      this.onloadend?.()
    })
  }
} as unknown as typeof FileReader

const glb = (await new GLTFExporter().parseAsync(figure, { binary: true, animations: clips })) as ArrayBuffer

// The engine's final character: the same figure with the hair colour it settled on, so the viewer crossfades to it.
const hairColor = face.geometry.getAttribute("color") as BufferAttribute
const finalHair = new Color(palette.finalHair)
for (let index = 0; index < hairColor.count; index += 1) {
  if (face.inPart(["hair"], index)) hairColor.setXYZ(index, finalHair.r, finalHair.g, finalHair.b)
}
const finalGlb = (await new GLTFExporter().parseAsync(figure, { binary: true, animations: clips })) as ArrayBuffer

// The photo: the figure seen by the viewer's front camera at zoom 1 in a 3:4 stage, drawn flat at the depth of the
// model's centre, so the 3D scene can take over from it without a jump.
figure.updateMatrixWorld(true)
const box = new Box3().setFromObject(figure)
const size = box.getSize(new Vector3())
const center = box.getCenter(new Vector3())
const width = 600
const height = 800
const aspect = width / height
const distance = fitBoxDistance([size.x, size.y, size.z], fieldOfView, aspect)
const view = viewSizeAt(distance, fieldOfView, aspect)
const px = (x: number) => Math.round(((x - center.x) / view.width + 0.5) * width * 10) / 10
const py = (y: number) => Math.round((0.5 - (y - center.y) / view.height) * height * 10) / 10
const len = (value: number) => Math.round((value / view.height) * height * 10) / 10

function capsule(x: number, top: number, bottom: number, radius: number, fill: string) {
  return `<rect x="${px(x - radius)}" y="${py(top + radius)}" width="${len(radius * 2)}" height="${len(top - bottom + radius * 2)}" rx="${len(radius)}" fill="${fill}"/>`
}

const armX = shoulder.x + 0.03
const svg = [
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
  `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e4ebf2"/><stop offset="1" stop-color="#c8d3df"/></linearGradient>`,
  `<radialGradient id="shade" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#fff" stop-opacity="0.35"/><stop offset="1" stop-color="#000" stop-opacity="0.18"/></radialGradient></defs>`,
  `<rect width="${width}" height="${height}" fill="url(#bg)"/>`,
  `<ellipse cx="${px(0)}" cy="${py(0)}" rx="${len(0.32)}" ry="${len(0.05)}" fill="#000" opacity="0.14"/>`,
  capsule(-0.1, 0.82, 0.1, 0.085, palette.pants),
  capsule(0.1, 0.82, 0.1, 0.085, palette.pants),
  `<ellipse cx="${px(-0.1)}" cy="${py(0.04)}" rx="${len(0.09)}" ry="${len(0.05)}" fill="${palette.shoes}"/>`,
  `<ellipse cx="${px(0.1)}" cy="${py(0.04)}" rx="${len(0.09)}" ry="${len(0.05)}" fill="${palette.shoes}"/>`,
  capsule(-armX, 1.27, 0.84, 0.062, palette.shirt),
  capsule(armX, 1.27, 0.84, 0.062, palette.shirt),
  `<circle cx="${px(-armX - 0.02)}" cy="${py(0.79)}" r="${len(0.06)}" fill="${palette.skin}"/>`,
  `<circle cx="${px(armX + 0.02)}" cy="${py(0.79)}" r="${len(0.06)}" fill="${palette.skin}"/>`,
  capsule(0, 1.32, 0.9, 0.2, palette.shirt),
  `<rect x="${px(-0.055)}" y="${py(1.46)}" width="${len(0.11)}" height="${len(0.12)}" fill="${palette.skin}"/>`,
  `<circle cx="${px(0)}" cy="${py(head.y)}" r="${len(head.radius)}" fill="${palette.skin}"/>`,
  `<path d="M ${px(-0.16)} ${py(head.y + 0.03)} A ${len(0.16)} ${len(0.16)} 0 0 1 ${px(0.16)} ${py(head.y + 0.03)} Q ${px(0)} ${py(head.y + 0.08)} ${px(-0.16)} ${py(head.y + 0.03)} Z" fill="${palette.hair}"/>`,
  ...eyes.map((eye) => `<circle cx="${px(eye.x)}" cy="${py(eye.y)}" r="${len(0.022)}" fill="${palette.eye}"/>`),
  `<path d="M ${px(-0.04)} ${py(mouth.y + 0.03)} Q ${px(0)} ${py(mouth.y - 0.01)} ${px(0.04)} ${py(mouth.y + 0.03)}" fill="none" stroke="${palette.mouth}" stroke-width="${len(0.016)}" stroke-linecap="round"/>`,
  `<rect width="${width}" height="${height}" fill="url(#shade)" opacity="0.5"/>`,
  `</svg>`,
].join("")

// What two detectors report: the face as fractions of the photo, and the body as fractions of a square frame the
// photo is padded into (aspect 1), as a pose model with a fixed input shape does.
const round = (value: number) => Math.round(value * 1000) / 1000
const point = (x: number, y: number) => ({ x: round(px(x) / width), y: round(py(y) / height) })
const ring = (cx: number, cy: number, rx: number, ry: number, count: number, from = 0, to = Math.PI * 2) =>
  Array.from({ length: count }, (_, index) => {
    const angle = from + ((to - from) * index) / count
    return point(cx + rx * Math.cos(angle), cy + ry * Math.sin(angle))
  })
const column = (x: number, top: number, bottom: number, count: number) =>
  Array.from({ length: count }, (_, index) => point(x, top - ((top - bottom) * index) / (count - 1)))
const facePoints = [
  ...ring(0, head.y, head.radius, head.radius, 24),
  ...eyes.flatMap((eye) => ring(eye.x, eye.y, 0.03, 0.018, 6)),
  ...ring(0, mouth.y + 0.02, 0.045, 0.02, 8, Math.PI, Math.PI * 2),
  point(0, 1.53),
]
const bodyPoints = [
  ...column(-0.2, 1.3, 0.92, 6),
  ...column(0.2, 1.3, 0.92, 6),
  ...column(-armX - 0.062, 1.25, 0.82, 5),
  ...column(armX + 0.062, 1.25, 0.82, 5),
  ...column(-0.185, 0.8, 0.08, 6),
  ...column(0.185, 0.8, 0.08, 6),
  ...column(0, 0.86, 0.12, 5),
]

mkdirSync(out, { recursive: true })
const interleave = (list: { x: number; y: number }[]) => list.flatMap(({ x, y }) => [x, y])
const square = (list: { x: number; y: number }[]) =>
  list.map(({ x, y }) => ({ x: round((1 - aspect) / 2 + x * aspect), y }))
writeFileSync(join(out, "figure.glb"), new Uint8Array(glb))
writeFileSync(join(out, "figure-final.glb"), new Uint8Array(finalGlb))
writeFileSync(join(out, "portrait.svg"), `${svg}\n`)
writeFileSync(
  join(out, "figure.json"),
  `${JSON.stringify(
    {
      width,
      height,
      faceBounds: { center: [0, head.y, 0.05], radius: 0.2 },
      landmarks: [
        { source: "face", aspect, points: interleave(facePoints) },
        { source: "body", aspect: 1, points: interleave(square(bodyPoints)) },
      ],
    },
    null,
    2,
  )}\n`,
)
console.log(
  `figure.glb ${String(glb.byteLength)} and figure-final.glb ${String(finalGlb.byteLength)} bytes, portrait.svg ${String(svg.length)} bytes, ${String(facePoints.length + bodyPoints.length)} points`,
)
