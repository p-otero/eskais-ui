import type { SkyRenderer, SkyScene } from "@/components/ui/live-sky-backdrop"
import type { GlassDrop } from "@/components/ui/live-sky-glass"
import { noiseTile } from "@/components/ui/live-sky-noise"
import { maxParticles, type Fall } from "@/components/ui/live-sky-precipitation"
import {
  backdropFragment,
  backdropVertex,
  dropFragment,
  dropVertex,
  fallFragment,
  fallVertex,
} from "@/components/ui/live-sky-shaders"

type GL = WebGLRenderingContext
type Program = {
  program: WebGLProgram
  uniform: (name: string) => WebGLUniformLocation | null
  attribute: (name: string) => number
}

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

function compile(gl: GL, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) throw new Error("WebGL couldn't create a shader.")
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(shader) ?? "A shader didn't compile.")
  return shader
}

function link(gl: GL, vertex: string, fragment: string): Program {
  const program = gl.createProgram()
  if (!program) throw new Error("WebGL couldn't create a program.")
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertex))
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragment))
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(program) ?? "A program didn't link.")
  const uniforms = new Map<string, WebGLUniformLocation | null>()
  return {
    program,
    uniform: (name) => {
      if (!uniforms.has(name)) uniforms.set(name, gl.getUniformLocation(program, name))
      return uniforms.get(name) ?? null
    },
    attribute: (name) => gl.getAttribLocation(program, name),
  }
}

function texture(gl: GL, repeat: boolean) {
  const created = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, created)
  const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  return created
}

function noiseTexture(gl: GL) {
  const tile = noiseTile()
  const pixels = new Uint8Array(tile.size * tile.size * 4)
  for (let index = 0; index < tile.size * tile.size; index++) {
    pixels[index * 4] = tile.billow[index]!
    pixels[index * 4 + 1] = tile.detail[index]!
    pixels[index * 4 + 3] = 255
  }
  const created = texture(gl, true)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, tile.size, tile.size, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
  return created
}

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

/** Draws the scene with WebGL: the clouds and veil in one full-screen pass, rain or snow as particles, drops as lenses. */
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
  const sky = texture(gl, false)
  const facades = texture(gl, false)
  let scene: SkyScene | null = null

  const bindTextures = (program: Program) => {
    ;[sky, facades, noise].forEach((bound, unit) => {
      gl.activeTexture(gl.TEXTURE0 + unit)
      gl.bindTexture(gl.TEXTURE_2D, bound)
    })
    gl.uniform1i(program.uniform("u_sky"), 0)
    gl.uniform1i(program.uniform("u_facades"), 1)
    gl.uniform1i(program.uniform("u_noise"), 2)
  }

  const enabled: number[] = []
  const attribute = (program: Program, name: string, size: number, stride: number, offset: number) => {
    const location = program.attribute(name)
    if (location < 0) return
    gl.enableVertexAttribArray(location)
    enabled.push(location)
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride * 4, offset * 4)
  }

  const drawTriangles = (count: number) => {
    gl.drawArrays(gl.TRIANGLES, 0, count)
    for (const location of enabled.splice(0)) gl.disableVertexAttribArray(location)
  }

  const drawBackdrop = (current: SkyScene, seconds: number, flash: number) => {
    const { deck, atmosphere, camera } = current
    gl.useProgram(backdrop.program)
    bindTextures(backdrop)
    gl.bindBuffer(gl.ARRAY_BUFFER, screen)
    attribute(backdrop, "a_corner", 2, 2, 0)
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
    gl.uniform1f(u("u_veil"), atmosphere.veil)
    gl.uniform3fv(u("u_veilColour"), atmosphere.colour)
    gl.uniform1f(u("u_sheets"), atmosphere.sheets)
    gl.uniform2f(u("u_sheetOffset"), (seconds * 0.05 + deck.drift.x * seconds * 40) % 1, (seconds * 0.02) % 1)
    gl.uniform1f(u("u_flash"), flash * 0.22)
    drawTriangles(3)
  }

  const drawFall = (current: SkyScene, layer: Fall, seconds: number) => {
    if (layer.count === 0) return
    gl.useProgram(fall.program)
    gl.bindBuffer(gl.ARRAY_BUFFER, particles)
    attribute(fall, "a_seed", 4, 6, 0)
    attribute(fall, "a_corner", 2, 6, 4)
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
    gl.uniform1f(u("u_focal"), camera.focal * current.ratio)
    gl.uniform1f(u("u_snow"), layer.kind === "snow" ? 1 : 0)
    gl.uniform3fv(u("u_colour"), layer.colour)
    gl.uniform1f(u("u_alpha"), layer.alpha)
    drawTriangles(layer.count * 6)
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
    bindTextures(drop)
    gl.bindBuffer(gl.ARRAY_BUFFER, drops)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, dropData.subarray(0, count * 6 * floatsPerDropVertex))
    attribute(drop, "a_centre", 2, floatsPerDropVertex, 0)
    attribute(drop, "a_corner", 2, floatsPerDropVertex, 2)
    attribute(drop, "a_shape", 3, floatsPerDropVertex, 4)
    gl.uniform2f(drop.uniform("u_size"), canvas.width, canvas.height)
    const highlight = 0.35 + current.light.ambient * 0.65
    gl.uniform3f(drop.uniform("u_highlight"), highlight, highlight, highlight)
    drawTriangles(count * 6)
  }

  return {
    kind: "webgl",
    setScene(next) {
      scene = next
      if (canvas.width !== next.sky.width) canvas.width = next.sky.width
      if (canvas.height !== next.sky.height) canvas.height = next.sky.height
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.bindTexture(gl.TEXTURE_2D, sky)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, next.sky)
      gl.bindTexture(gl.TEXTURE_2D, facades)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, next.facades)
    },
    draw(seconds, list, flash) {
      if (!scene) return
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
