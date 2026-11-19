import {
  DataTexture,
  MeshToonMaterial,
  NearestFilter,
  RedFormat,
  type Material,
  type Mesh,
  type MeshStandardMaterial,
  type Object3D,
} from "three"

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
      parts.push(Object.keys((mesh as Partial<MorphMesh>).morphTargetDictionary ?? {}).join(","))
      for (const material of [mesh.material].flat()) {
        const color = (material as MeshStandardMaterial).color
        parts.push(color ? color.getHexString() : material.type)
      }
      return parts.join("|")
    })
    .join(";")
}

export { isMesh, signatureOf, targetNamesOf, toonGradient, toonOf }
export type { MorphMesh }
