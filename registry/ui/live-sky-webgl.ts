import type { SkyRenderer, SkyScene } from "@/components/ui/live-sky-backdrop"
import { attributes, bindTextures, link, noiseTexture, texture, type GL } from "@/components/ui/live-sky-gl"
import type { GlassDrop } from "@/components/ui/live-sky-glass"
import { maxParticles, type Fall } from "@/components/ui/live-sky-precipitation"
import { createRelighter } from "@/components/ui/live-sky-relight"
import {
  backdropFragment,
  backdropVertex,
  dropFragment,
  dropVertex,
  fallFragment,
  fallVertex,
} from "@/components/ui/live-sky-shaders"

const maxDrops = 320
const floatsPerDropVertex = 7
const dropCorners: [number, number][] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, -1],
  [1, 1],
  [-1, 1],
]
const sunStepTiles = 0.035

function particleBuffer(gl: GL) {
  const data = new Float32Array(maxParticles * 6 * 6)
  const corners = [
    [0, -1],
    [1, -1],
    [1, 1],
    [0, -1],
    [1, 1],
    [0, 1],
  ]
  for (let particle = 0; particle < maxParticles; particle++) {
    const seed = [Math.random(), Math.random(), Math.random(), Math.random()]
    corners.forEach(([along, across], corner) => {
      data.set([...seed, along!, across!], (particle * 6 + corner) * 6)
    })
  }
  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
  return buffer
}

/**
 * Draws the scene with WebGL: the lit street and the clouds in one full-screen pass, rain or snow as particles, drops
 * as lenses. The street is lit into a texture only when the weather or the street changes.
 */
function createWebGLRenderer(canvas: HTMLCanvasElement, gl: GL): SkyRenderer {
  const backdrop = link(gl, backdropVertex, backdropFragment)
  const fall = link(gl, fallVertex, fallFragment)
  const drop = link(gl, dropVertex, dropFragment)
  const screen = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, screen)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const particles = particleBuffer(gl)
  const drops = gl.createBuffer()
  const dropData = new Float32Array(maxDrops * 6 * floatsPerDropVertex)
  gl.bindBuffer(gl.ARRAY_BUFFER, drops)
  gl.bufferData(gl.ARRAY_BUFFER, dropData.byteLength, gl.DYNAMIC_DRAW)
  const noise = noiseTexture(gl)
  const sky = texture(gl)
  const relighter = createRelighter(gl, screen, noise)
  const vertices = attributes(gl)
  let scene: SkyScene | null = null
  let stale = false
  let photoShown = false
  const bloomOf = (current: SkyScene) => (photoShown ? current.photoLighting.bloom : current.lighting.bloom)

  const drawBackdrop = (current: SkyScene, seconds: number, flash: number) => {
    const { deck, atmosphere, camera } = current
    gl.useProgram(backdrop.program)
    bindTextures(gl, backdrop, { u_sky: sky, u_facades: relighter.lit(), u_noise: noise, u_glowMap: relighter.glow() })
    gl.bindBuffer(gl.ARRAY_BUFFER, screen)
    vertices.bind(backdrop, "a_corner", 2, 2, 0)
    const u = backdrop.uniform
    gl.uniform2f(u("u_size"), canvas.width, canvas.height)
    gl.uniform1f(u("u_focal"), camera.focal * current.ratio)
    gl.uniform3f(u("u_forward"), camera.forward.x, camera.forward.y, camera.forward.z)
    gl.uniform3f(u("u_right"), camera.right.x, camera.right.y, camera.right.z)
    gl.uniform3f(u("u_up"), camera.up.x, camera.up.y, camera.up.z)
    gl.uniform1f(u("u_base"), deck.base)
    gl.uniform1f(u("u_tile"), deck.tile)
    gl.uniform2f(u("u_offset"), (deck.drift.x * seconds) % 1, (deck.drift.y * seconds) % 1)
    gl.uniform1f(u("u_threshold"), deck.threshold)
    gl.uniform1f(u("u_softness"), deck.softness)
    gl.uniform1f(u("u_shadeBias"), deck.shadeBias)
    gl.uniform3fv(u("u_lit"), deck.lit)
    gl.uniform3fv(u("u_shade"), deck.shade)
    gl.uniform3fv(u("u_horizon"), deck.horizon)
    gl.uniform3fv(u("u_sunGlow"), deck.sunGlow)
    gl.uniform3f(u("u_sun"), deck.sun.x, deck.sun.y, deck.sun.z)
    const across = Math.hypot(deck.sun.x, deck.sun.z) || 1
    gl.uniform2f(u("u_sunStep"), (deck.sun.x / across) * sunStepTiles, (deck.sun.z / across) * sunStepTiles)
    gl.uniform1f(u("u_veil"), atmosphere.veil)
    gl.uniform3fv(u("u_veilColour"), atmosphere.colour)
    gl.uniform1f(u("u_sheets"), atmosphere.sheets)
    gl.uniform2f(u("u_sheetScale"), atmosphere.sheetScale[0], atmosphere.sheetScale[1])
    gl.uniform2f(u("u_sheetOffset"), (seconds * 0.05 + deck.drift.x * seconds * 40) % 1, (seconds * 0.02) % 1)
    gl.uniform1f(u("u_flash"), flash * 0.22)
    gl.uniform1f(u("u_bloom"), bloomOf(current))
    vertices.draw(3)
  }

  const drawFall = (current: SkyScene, layer: Fall, seconds: number) => {
    if (layer.count === 0) return
    gl.useProgram(fall.program)
    bindTextures(gl, fall, { u_glowMap: relighter.glow(), u_noise: noise })
    gl.bindBuffer(gl.ARRAY_BUFFER, particles)
    vertices.bind(fall, "a_seed", 4, 6, 0)
    vertices.bind(fall, "a_corner", 2, 6, 4)
    const u = fall.uniform
    const { camera } = current
    gl.uniform1f(u("u_time"), seconds % 3600)
    gl.uniform1f(u("u_period"), layer.period)
    gl.uniform3f(u("u_velocity"), layer.velocity.x, layer.velocity.y, layer.velocity.z)
    gl.uniform1f(u("u_exposure"), layer.exposure)
    gl.uniform1f(u("u_depth"), layer.depth)
    gl.uniform1f(u("u_diameter"), layer.diameter)
    gl.uniform1f(u("u_sway"), layer.sway)
    gl.uniform2f(u("u_tan"), camera.width / 2 / camera.focal, camera.height / 2 / camera.focal)
    gl.uniform2f(u("u_size"), canvas.width, canvas.height)
    gl.uniform2f(u("u_screen"), canvas.width, canvas.height)
    gl.uniform1f(u("u_focal"), camera.focal * current.ratio)
    gl.uniform1f(u("u_snow"), layer.kind === "snow" ? 1 : 0)
    gl.uniform3fv(u("u_colour"), layer.colour)
    gl.uniform1f(u("u_alpha"), layer.alpha)
    gl.uniform1f(u("u_bloom"), bloomOf(current))
    gl.uniform1f(u("u_sheets"), layer.sheets)
    gl.uniform1f(
      u("u_sheetShift"),
      (seconds * (0.05 + Math.abs(layer.velocity.x) * 0.02) * Math.sign(layer.velocity.x || 1)) % 1,
    )
    gl.uniform1f(u("u_farFade"), photoShown ? 1 : 0)
    vertices.draw(layer.count * 6)
  }

  const drawDrops = (current: SkyScene, list: readonly GlassDrop[]) => {
    const count = Math.min(maxDrops, list.length)
    if (count === 0) return
    for (let index = 0; index < count; index++) {
      const glassDrop = list[index]!
      const shape = [glassDrop.radius * current.ratio, glassDrop.alpha, glassDrop.splash > 0 ? 1 : 0]
      dropCorners.forEach(([x, y], corner) => {
        dropData.set(
          [glassDrop.x * current.ratio, glassDrop.y * current.ratio, x, y, ...shape],
          (index * 6 + corner) * floatsPerDropVertex,
        )
      })
    }
    gl.useProgram(drop.program)
    bindTextures(gl, drop, { u_sky: sky, u_facades: relighter.lit(), u_glowMap: relighter.glow() })
    gl.bindBuffer(gl.ARRAY_BUFFER, drops)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, dropData.subarray(0, count * 6 * floatsPerDropVertex))
    vertices.bind(drop, "a_centre", 2, floatsPerDropVertex, 0)
    vertices.bind(drop, "a_corner", 2, floatsPerDropVertex, 2)
    vertices.bind(drop, "a_shape", 3, floatsPerDropVertex, 4)
    gl.uniform2f(drop.uniform("u_size"), canvas.width, canvas.height)
    gl.uniform1f(drop.uniform("u_bloom"), bloomOf(current))
    const highlight = 0.35 + current.light.ambient * 0.65
    gl.uniform3f(drop.uniform("u_highlight"), highlight, highlight, highlight)
    vertices.draw(count * 6)
  }

  return {
    kind: "webgl",
    setScene(next) {
      scene = next
      stale = true
      if (canvas.width !== next.sky.width) canvas.width = next.sky.width
      if (canvas.height !== next.sky.height) canvas.height = next.sky.height
      gl.bindTexture(gl.TEXTURE_2D, sky)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, next.sky)
    },
    setBackground(background) {
      relighter.setBackground(background)
      photoShown = background.kind === "photo"
      stale = true
    },
    draw(seconds, list, flash) {
      if (!scene) return
      if (stale) {
        gl.disable(gl.BLEND)
        relighter.relight(scene)
        stale = false
      }
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.disable(gl.BLEND)
      drawBackdrop(scene, seconds, flash)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
      for (const layer of scene.falls) drawFall(scene, layer, seconds)
      drawDrops(scene, list)
    },
    dispose() {
      gl.getExtension("WEBGL_lose_context")?.loseContext()
    },
  }
}

export { createWebGLRenderer }
