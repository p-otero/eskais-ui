import {
  Color,
  DataTexture,
  MeshToonMaterial,
  NearestFilter,
  RedFormat,
  Texture,
  type Material,
  type Mesh,
  type Object3D,
} from "three"

type MorphMesh = Mesh & { morphTargetDictionary: Record<string, number>; morphTargetInfluences: number[] }

const isMesh = (object: Object3D): object is Mesh => "isMesh" in object && object.isMesh === true

const isMorphMesh = (mesh: Mesh): mesh is MorphMesh =>
  mesh.morphTargetDictionary !== undefined && mesh.morphTargetInfluences !== undefined

// Workaround: `Material` declares neither: the standard, physical, basic and toon materials a GLB loads each add their own.
const colorOf = (material: Material) =>
  "color" in material && material.color instanceof Color ? material.color : undefined
const mapOf = (material: Material) => ("map" in material && material.map instanceof Texture ? material.map : null)

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
  return new MeshToonMaterial({
    name: material.name,
    color: colorOf(material),
    map: mapOf(material),
    vertexColors: material.vertexColors,
    transparent: material.transparent,
    opacity: material.opacity,
    side: material.side,
    gradientMap,
  })
}

/**
 * The target names in the GLB's order: each mesh's `extras.targetNames` (GLTFLoader reads them into its morph
 * dictionary), meshes in scene order, each name once.
 */
function targetNamesOf(meshes: readonly MorphMesh[]) {
  const names: string[] = []
  for (const mesh of meshes) {
    const ordered = Object.entries(mesh.morphTargetDictionary).toSorted((a, b) => a[1] - b[1])
    for (const [name] of ordered) if (!names.includes(name)) names.push(name)
  }
  return names
}

/**
 * A mesh's `extras.targetScales` (GLTFLoader copies a mesh's extras into its `userData`): one multiplier per target,
 * in the order of its targets, for a GLB that stores each target scaled to fill its quantized range. A weight `w`
 * becomes the influence `w × scale`. Undefined unless it is one finite number per target.
 */
function targetScalesOf(mesh: MorphMesh): readonly number[] | undefined {
  const scales: unknown = mesh.userData["targetScales"]
  if (!Array.isArray(scales) || scales.length !== mesh.morphTargetInfluences.length) return undefined
  return scales.every((scale): scale is number => typeof scale === "number" && Number.isFinite(scale))
    ? scales
    : undefined
}

/**
 * What a model looks like, cheaply: meshes, vertex counts, target names, material colours and a sample of positions
 * and vertex colours. Two models with the same signature look the same, so one replaces the other with no transition.
 */
function signatureOf(surfaces: readonly Mesh[]) {
  return surfaces
    .map((mesh) => {
      const parts = [mesh.name]
      for (const name of ["position", "color"]) {
        const attribute = mesh.geometry.getAttribute(name)
        if (!attribute) continue
        let sum = 0
        const values = attribute.array
        for (let i = 0; i < values.length; i += 97) sum += values[i] ?? 0
        parts.push(`${name}:${String(attribute.count)}:${sum.toFixed(4)}`)
      }
      parts.push(Object.keys(mesh.morphTargetDictionary ?? {}).join(","))
      for (const material of [mesh.material].flat()) {
        const color = colorOf(material)
        parts.push(color ? color.getHexString() : material.type)
      }
      return parts.join("|")
    })
    .join(";")
}

export { isMesh, isMorphMesh, signatureOf, targetNamesOf, targetScalesOf, toonGradient, toonOf }
export type { MorphMesh }
