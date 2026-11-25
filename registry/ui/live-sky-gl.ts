import { noiseTile } from "@/components/ui/live-sky-noise"

type GL = WebGLRenderingContext

type Program = {
  program: WebGLProgram
  uniform: (name: string) => WebGLUniformLocation | null
  attribute: (name: string) => number
}

/** A texture drawn into: its framebuffer and its size in pixels. */
type Target = { texture: WebGLTexture | null; framebuffer: WebGLFramebuffer | null; width: number; height: number }

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

function texture(gl: GL, { repeat = false, nearest = false } = {}) {
  const created = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, created)
  const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE
  const filter = nearest ? gl.NEAREST : gl.LINEAR
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4))
  return created
}

function upload(gl: GL, into: WebGLTexture | null, width: number, height: number, bytes: Uint8Array) {
  gl.bindTexture(gl.TEXTURE_2D, into)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, bytes)
}

function target(gl: GL): Target {
  return { texture: texture(gl), framebuffer: gl.createFramebuffer(), width: 0, height: 0 }
}

function resizeTarget(gl: GL, drawn: Target, width: number, height: number) {
  if (drawn.width === width && drawn.height === height) return
  drawn.width = width
  drawn.height = height
  gl.bindTexture(gl.TEXTURE_2D, drawn.texture)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  gl.bindFramebuffer(gl.FRAMEBUFFER, drawn.framebuffer)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, drawn.texture, 0)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
}

function noiseTexture(gl: GL) {
  const tile = noiseTile()
  const pixels = new Uint8Array(tile.size * tile.size * 4)
  for (let index = 0; index < tile.size * tile.size; index++) {
    pixels[index * 4] = tile.billow[index]!
    pixels[index * 4 + 1] = tile.detail[index]!
    pixels[index * 4 + 3] = 255
  }
  const created = texture(gl, { repeat: true })
  upload(gl, created, tile.size, tile.size, pixels)
  return created
}

/** Binds vertex attributes for one draw, then releases them so the next program finds none left enabled. */
function attributes(gl: GL) {
  const enabled: number[] = []
  return {
    bind(program: Program, name: string, size: number, stride: number, offset: number) {
      const location = program.attribute(name)
      if (location < 0) return
      gl.enableVertexAttribArray(location)
      enabled.push(location)
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride * 4, offset * 4)
    },
    draw(count: number) {
      gl.drawArrays(gl.TRIANGLES, 0, count)
      for (const location of enabled.splice(0)) gl.disableVertexAttribArray(location)
    },
  }
}

/** Binds textures to units in order and names them in the program. */
function bindTextures(gl: GL, program: Program, textures: Record<string, WebGLTexture | null>) {
  Object.entries(textures).forEach(([name, bound], unit) => {
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, bound)
    gl.uniform1i(program.uniform(name), unit)
  })
}

export { attributes, bindTextures, link, noiseTexture, resizeTarget, target, texture, upload }
export type { GL, Program, Target }
