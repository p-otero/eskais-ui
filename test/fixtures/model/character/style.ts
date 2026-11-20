import {
  BackSide,
  Color,
  DataTexture,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  NearestFilter,
  RedFormat,
  type Material,
  type Object3D,
} from "three"

// The demo character's styles, after the engine's reference three.js materials (eskais-character/three, MIT): each
// material carries its style in `extras.eskais`, which GLTFLoader puts in `material.userData`. ModelViewer doesn't
// read it; a viewer's `onModelLoad` calls `styleCharacter`, so the model is drawn styled from its first frame.

type CharacterStyle = {
  id: string
  /** Brightness `levels[i]` for diffuse light above `steps[i]`; `softness` blurs each step. */
  ramp: { steps: number[]; levels: number[]; softness: number }
  /** An inverted hull, `width` in metres (0 for none), linear RGB. */
  outline: { width: number; color: [number, number, number] }
  rim: { strength: number; power: number }
}

type CharacterExtras = { role?: string; style?: CharacterStyle }

const extrasOf = (material: Material) => (material.userData as { eskais?: CharacterExtras }).eskais

const smoothstep = (from: number, to: number, value: number) => {
  const t = Math.min(Math.max((value - from) / (to - from), 0), 1)
  return t * t * (3 - 2 * t)
}

function rampLevel({ ramp }: CharacterStyle, lambert: number) {
  let level = ramp.levels[0] ?? 1
  ramp.steps.forEach((step, index) => {
    const from = ramp.levels[index] ?? level
    const to = ramp.levels[index + 1] ?? level
    const t =
      ramp.softness <= 0
        ? Number(lambert >= step)
        : smoothstep(step - ramp.softness / 2, step + ramp.softness / 2, lambert)
    if (t > 0) level = from + (to - from) * t
  })
  return level
}

function rampTexture(style: CharacterStyle, size = 64) {
  const data = Uint8Array.from({ length: size }, (_, index) => Math.round(rampLevel(style, index / (size - 1)) * 255))
  const texture = new DataTexture(data, size, 1, RedFormat)
  const filter = style.ramp.softness > 0.05 ? LinearFilter : NearestFilter
  texture.minFilter = filter
  texture.magFilter = filter
  texture.needsUpdate = true
  return texture
}

function toonMaterial(source: Material, style: CharacterStyle, gradientMap: DataTexture) {
  const material = new MeshToonMaterial({
    color: new Color(1, 1, 1),
    vertexColors: true,
    gradientMap,
    side: source.side,
  })
  material.name = `${source.name}-${style.id}`
  const { strength, power } = style.rim
  // A rim light at grazing angles, which the toon ramp alone doesn't give.
  material.onBeforeCompile = (shader) => {
    shader.uniforms.rimStrength = { value: strength }
    shader.uniforms.rimPower = { value: power }
    shader.fragmentShader = shader.fragmentShader
      .replace("void main() {", "uniform float rimStrength;\nuniform float rimPower;\nvoid main() {")
      .replace(
        "#include <opaque_fragment>",
        [
          "float rimFacing = clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);",
          "outgoingLight += diffuseColor.rgb * (2.0 * rimStrength * pow(1.0 - rimFacing, rimPower));",
          "#include <opaque_fragment>",
        ].join("\n"),
      )
  }
  material.customProgramCacheKey = () => `character-toon-${String(strength)}-${String(power)}`
  return material
}

function outlineMaterial(style: CharacterStyle) {
  const material = new MeshBasicMaterial({ color: new Color(...style.outline.color), side: BackSide })
  material.name = `outline-${style.id}`
  const width = style.outline.width
  material.onBeforeCompile = (shader) => {
    shader.uniforms.outlineWidth = { value: width }
    // Pushed out before morphing and skinning, so the hull follows both.
    shader.vertexShader = shader.vertexShader
      .replace("void main() {", "uniform float outlineWidth;\nvoid main() {")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\ntransformed += normalize(normal) * outlineWidth;")
  }
  material.customProgramCacheKey = () => "character-outline"
  return material
}

/**
 * Restyles a loaded character in place from its materials' `extras.eskais.style`: toon materials on its ramp, and an
 * inverted-hull outline when the style has one (never on the eyes). Returns what frees everything it made.
 */
function styleCharacter(root: Object3D) {
  const created: { dispose(): void }[] = []
  const ramps = new Map<string, DataTexture>()
  const meshes: Mesh[] = []
  root.traverse((object) => {
    if (object instanceof Mesh) meshes.push(object)
  })
  for (const mesh of meshes) {
    const source = [mesh.material].flat()[0] as Material | undefined
    const extras = source && extrasOf(source)
    const style = extras?.style
    if (!source || !style) continue
    let ramp = ramps.get(style.id)
    if (!ramp) {
      ramp = rampTexture(style)
      ramps.set(style.id, ramp)
      created.push(ramp)
    }
    const material = toonMaterial(source, style, ramp)
    created.push(material)
    mesh.material = material
    if (style.outline.width <= 0 || extras.role === "eyes") continue
    const outline = mesh.clone(false) as Mesh
    // One influences array for both, so the outline follows the live morph weights.
    outline.morphTargetInfluences = mesh.morphTargetInfluences
    outline.material = outlineMaterial(style)
    created.push(outline.material)
    outline.userData = { outline: true }
    outline.renderOrder = mesh.renderOrder - 1
    mesh.parent?.add(outline)
  }
  return () => {
    for (const item of created) item.dispose()
  }
}

export { styleCharacter }
export type { CharacterStyle }
