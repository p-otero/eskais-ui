import {
  BackSide,
  BoxGeometry,
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  Texture,
  Vector3,
  type BufferGeometry,
  type Camera,
  type Material,
  type Object3D,
  type WebGLRenderer,
} from "three"

/** The stage's size in CSS pixels and the device pixels per CSS pixel. */
type StageSize = { width: number; height: number; pixelRatio: number }

/** A light panel of the studio: its size, brightness, where it hangs (it faces the middle) and its tint. */
type Softbox = {
  width: number
  height: number
  intensity: number
  at: readonly [number, number, number]
  tint?: number
}

const maxPixelRatio = 2
const softwarePixelRatio = 0.75
const softwareRenderers = /swiftshader|llvmpipe|softpipe|basic render|warp/i

function rendererName(gl: WebGLRenderingContext | WebGL2RenderingContext) {
  const debug = gl.getExtension("WEBGL_debug_renderer_info")
  return String(gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER))
}

/** Whether WebGL runs on the CPU (SwiftShader, llvmpipe, WARP), where every frame is costly. */
const isSoftwareRenderer = (renderer: WebGLRenderer) => softwareRenderers.test(rendererName(renderer.getContext()))

/** Device pixels per CSS pixel to draw at: at most 2, and below 1 on a software renderer. */
const stagePixelRatio = (software: boolean, pixelRatio: number) =>
  software ? softwarePixelRatio : Math.min(maxPixelRatio, pixelRatio)

const darkStudio: readonly Softbox[] = [
  { width: 40, height: 14, intensity: 6, at: [0, 45, 10] },
  { width: 10, height: 60, intensity: 4, at: [-45, 10, 10], tint: 0xfff1e0 },
  { width: 8, height: 50, intensity: 3, at: [45, 15, -10], tint: 0xdfe8ff },
  { width: 60, height: 6, intensity: 1.2, at: [0, 6, 46] },
]

function softboxStudio(softboxes: readonly Softbox[]) {
  const room = new Scene()
  room.add(new Mesh(new BoxGeometry(100, 100, 100), new MeshBasicMaterial({ color: 0x0a0a0c, side: BackSide })))
  for (const { width, height, intensity, at, tint = 0xffffff } of softboxes) {
    const material = new MeshBasicMaterial({
      color: new Color(tint).multiplyScalar(intensity),
      side: DoubleSide,
    })
    const panel = new Mesh(new PlaneGeometry(width, height), material)
    panel.position.copy(new Vector3(...at))
    panel.lookAt(0, 0, 0)
    room.add(panel)
  }
  return room
}

function texturesOf(root: Object3D) {
  const textures = new Set<Texture>()
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const mesh: Mesh = object
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value)
    }
  })
  return textures
}

/** Frees the geometries, materials and textures of every mesh under `root`. */
function disposeAll(root: Object3D) {
  const used = new Set<Material>()
  const geometries = new Set<BufferGeometry>()
  for (const texture of texturesOf(root)) texture.dispose()
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const mesh: Mesh = object
    geometries.add(mesh.geometry)
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) used.add(material)
  })
  for (const geometry of geometries) geometry.dispose()
  for (const material of used) material.dispose()
}

/**
 * A dark studio lit by softboxes, prefiltered for reflections. A room environment washes dark materials grey; this
 * keeps them dark with bright edges. `cubeSize` (256 by default) sets its resolution and memory. Dispose the returned
 * texture with the scene.
 */
function studioEnvironment(renderer: WebGLRenderer, softboxes: readonly Softbox[] = darkStudio, cubeSize?: number) {
  const pmrem = new PMREMGenerator(renderer)
  const studio = softboxStudio(softboxes)
  const environment = pmrem.fromScene(studio, 0.02, 0.1, 100, cubeSize === undefined ? {} : { size: cubeSize })
  disposeAll(studio)
  pmrem.dispose()
  return environment
}

const nextFrame = () =>
  new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => resolve())
    else setTimeout(resolve, 16)
  })

/**
 * Compiles the scene's shaders off the GPU's main thread, then uploads its textures one per frame, so the first frame
 * doesn't stall the page.
 */
async function prepareScene(renderer: WebGLRenderer, scene: Scene, camera: Camera) {
  await renderer.compileAsync(scene, camera)
  await [...texturesOf(scene)].reduce(
    (uploaded, texture) => uploaded.then(nextFrame).then(() => renderer.initTexture(texture)),
    Promise.resolve(),
  )
  await nextFrame()
}

export { darkStudio, disposeAll, isSoftwareRenderer, prepareScene, stagePixelRatio, studioEnvironment, texturesOf }
export type { Softbox, StageSize }
