import { MeshPhysicalMaterial, MeshStandardMaterial, Shape } from "three"

import { brushedLines, knurl, orangePeel, radialBrush, safeTextureSizes } from "@/components/ui/safe-vault-textures"
import type { Softbox } from "@/lib/three-studio"
import { canvasTexture, noise, repeating } from "@/lib/three-textures"

const studio: readonly Softbox[] = [
  { width: 40, height: 14, intensity: 7, at: [0, 45, 10] },
  { width: 50, height: 30, intensity: 1.6, at: [-10, 10, 45] },
  { width: 10, height: 60, intensity: 4, at: [-45, 10, 20], tint: 0xfff1e0 },
  { width: 8, height: 50, intensity: 3, at: [45, 15, -10], tint: 0xdfe8ff },
  { width: 60, height: 6, intensity: 1.2, at: [0, 6, 46] },
]

const sized = (name: keyof typeof safeTextureSizes) => {
  const { width: w, height: h } = safeTextureSizes[name]
  return { width: w, height: h }
}

function roundedRect(w: number, h: number, radius: number) {
  const shape = new Shape()
  const x = -w / 2
  const y = -h / 2
  shape.moveTo(x + radius, y)
  shape.lineTo(x + w - radius, y)
  shape.quadraticCurveTo(x + w, y, x + w, y + radius)
  shape.lineTo(x + w, y + h - radius)
  shape.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
  shape.lineTo(x + radius, y + h)
  shape.quadraticCurveTo(x, y + h, x, y + h - radius)
  shape.lineTo(x, y + radius)
  shape.quadraticCurveTo(x, y, x + radius, y)
  return shape
}

function materials() {
  const peel = repeating(canvasTexture(sized("peel"), orangePeel(7), false), 0.09)
  const peelBox = repeating(canvasTexture(sized("peel"), orangePeel(9), false), 4)
  const peelRough = repeating(
    canvasTexture(sized("peelRoughness"), (c, s) => noise(c, s, 150, 40, false, 3), false),
    0.07,
  )
  const knurled = repeating(canvasTexture(sized("knurl"), knurl, false), 3, 1)
  const brush = canvasTexture(sized("radialBrush"), radialBrush, false)
  const brushed = canvasTexture(sized("brushedLines"), brushedLines, false)
  const powder = {
    color: 0x3a3c40,
    roughness: 0.58,
    metalness: 0.15,
    bumpScale: 0.5,
    clearcoat: 0.12,
    clearcoatRoughness: 0.55,
  }
  const dimInside = { envMapIntensity: 0.22 }
  return {
    steel: new MeshPhysicalMaterial({
      ...powder,
      bumpMap: peel,
      roughnessMap: peelRough,
    }),
    steelBox: new MeshPhysicalMaterial({ ...powder, bumpMap: peelBox }),
    jamb: new MeshStandardMaterial({
      color: 0x2a2b2e,
      roughness: 0.5,
      metalness: 0.4,
      bumpMap: peel,
      bumpScale: 0.3,
    }),
    doorInner: new MeshStandardMaterial({
      color: 0x1b1c1f,
      roughness: 0.7,
      metalness: 0.3,
      bumpMap: peelBox,
      bumpScale: 0.3,
    }),
    chrome: new MeshStandardMaterial({
      color: 0xe9ebef,
      metalness: 1,
      roughness: 0.12,
    }),
    satin: new MeshStandardMaterial({
      color: 0xd4d7dc,
      metalness: 1,
      roughness: 0.26,
      bumpMap: brush,
      bumpScale: 0.15,
    }),
    knurled: new MeshStandardMaterial({
      color: 0xd8dbe0,
      metalness: 1,
      roughness: 0.22,
      bumpMap: knurled,
      bumpScale: 1,
    }),
    face: new MeshStandardMaterial({
      color: 0xe4e7eb,
      metalness: 1,
      roughness: 0.32,
      bumpScale: 1.2,
    }),
    hinge: new MeshStandardMaterial({
      color: 0x2a2b2e,
      metalness: 0.8,
      roughness: 0.32,
    }),
    hole: new MeshStandardMaterial({ color: 0x18181a, roughness: 0.8, metalness: 0.4 }),
    rubber: new MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.9 }),
    felt: new MeshStandardMaterial({
      color: 0x3b3028,
      roughness: 1,
      ...dimInside,
    }),
    panel: new MeshStandardMaterial({
      color: 0x77716a,
      metalness: 0.6,
      roughness: 0.4,
      bumpMap: brushed,
      bumpScale: 0.25,
      ...dimInside,
    }),
    seam: new MeshStandardMaterial({
      color: 0x0c0b0a,
      roughness: 1,
      ...dimInside,
    }),
    led: new MeshStandardMaterial({
      color: 0x111111,
      emissive: 0xffc27a,
      emissiveIntensity: 0,
    }),
  }
}

type Materials = ReturnType<typeof materials>

export { materials, roundedRect, sized, studio }
export type { Materials }
