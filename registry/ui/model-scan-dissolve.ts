import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Mesh,
  PlaneGeometry,
  Points,
  ShaderMaterial,
  type Texture,
  type Vector3,
} from "three"

// The same noise decides where the photo burns away and when each particle leaves it, so particles fly off from
// the burning edge. Value noise over a hash, cheap enough per vertex and per fragment.
const noise = /* glsl */ `
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float burn(vec2 uv) { return valueNoise(uv * 9.0) * 0.75 + hash(floor(uv * 140.0)) * 0.25; }
float edgeOf(float progress) { return progress * 1.3 - 0.15; }
`

const planeVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const planeFragment = /* glsl */ `
uniform sampler2D map;
uniform float progress;
uniform float opacity;
uniform vec3 edgeColor;
varying vec2 vUv;
${noise}
void main() {
  vec4 color = texture2D(map, vUv);
  float n = burn(vUv);
  float edge = edgeOf(progress);
  if (progress > 0.0 && n < edge) discard;
  float glow = progress > 0.0 ? smoothstep(edge + 0.06, edge, n) : 0.0;
  gl_FragColor = vec4(mix(color.rgb, edgeColor, glow), color.a * opacity);
  #include <colorspace_fragment>
}
`

const particleVertex = /* glsl */ `
attribute vec2 spot;
attribute vec3 drift;
uniform sampler2D map;
uniform float progress;
uniform vec2 size;
uniform float pointSize;
uniform vec3 edgeColor;
varying vec4 vColor;
${noise}
void main() {
  float age = (edgeOf(progress) - burn(spot)) / 0.45;
  if (age <= 0.0 || age >= 1.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vColor = vec4(0.0);
    return;
  }
  vec3 local = vec3((spot - 0.5) * size, 0.0) + drift * age + vec3(0.0, age * age * size.y * 0.12, 0.0);
  vec4 view = modelViewMatrix * vec4(local, 1.0);
  gl_Position = projectionMatrix * view;
  gl_PointSize = pointSize * (1.0 - age * 0.6) / -view.z;
  vec3 color = mix(texture2D(map, spot).rgb, edgeColor, smoothstep(0.35, 0.0, age) * 0.6);
  vColor = vec4(color, (1.0 - age) * 0.8 * texture2D(map, spot).a);
}
`

const particleFragment = /* glsl */ `
varying vec4 vColor;
void main() {
  if (length(gl_PointCoord - 0.5) > 0.5) discard;
  gl_FragColor = vColor;
  #include <colorspace_fragment>
}
`

/** Columns of particles across the photo; rows follow its ratio. */
const particleColumns = 72

/**
 * The photo on a plane, and particles on a grid over it. Set `progress` from 0 (the photo, whole) to 1 (burned
 * away, its particles gone) and `opacity` for a plain fade. Sizes are set per frame by `place`.
 */
function createDissolve(texture: Texture, ratio: number, edge: Color) {
  const uniforms = {
    map: { value: texture },
    progress: { value: 0 },
    opacity: { value: 1 },
    edgeColor: { value: edge },
    size: { value: [1, 1] },
    pointSize: { value: 1 },
  }
  const plane = new Mesh(
    new PlaneGeometry(1, 1),
    new ShaderMaterial({
      uniforms,
      vertexShader: planeVertex,
      fragmentShader: planeFragment,
      transparent: true,
    }),
  )
  plane.renderOrder = 1

  const rows = Math.max(1, Math.round(particleColumns / ratio))
  const count = particleColumns * rows
  const spots = new Float32Array(count * 2)
  const drifts = new Float32Array(count * 3)
  let seed = 7
  const random = () => {
    seed = (seed * 16_807) % 2_147_483_647
    return seed / 2_147_483_647
  }
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < particleColumns; column += 1) {
      const index = row * particleColumns + column
      spots.set([(column + 0.5) / particleColumns, (row + 0.5) / rows], index * 2)
      drifts.set([(random() - 0.5) * 0.5, random() * 0.25, 0.15 + random() * 0.45], index * 3)
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(count * 3), 3))
  geometry.setAttribute("spot", new BufferAttribute(spots, 2))
  geometry.setAttribute("drift", new BufferAttribute(drifts, 3))
  const particles = new Points(
    geometry,
    new ShaderMaterial({
      uniforms,
      vertexShader: particleVertex,
      fragmentShader: particleFragment,
      transparent: true,
      depthWrite: false,
    }),
  )
  particles.frustumCulled = false
  particles.renderOrder = 2

  return {
    plane,
    particles,
    uniforms,
    /** Puts the photo at `center`, `width` × `height` in world units, its particles too, at `pixels` per world unit. */
    place(center: Vector3, width: number, height: number, pixels: number) {
      plane.position.copy(center)
      particles.position.copy(center)
      plane.scale.set(width, height, 1)
      uniforms.size.value = [width, height]
      uniforms.pointSize.value = (width / particleColumns) * pixels * 1.2
    },
    /** How far the photo has burned (0 to 1), how opaque it is, and whether its particles show. */
    set({ progress, opacity, particles: shown }: { progress?: number; opacity?: number; particles?: boolean }) {
      if (progress !== undefined) uniforms.progress.value = progress
      if (opacity !== undefined) uniforms.opacity.value = opacity
      if (shown !== undefined) particles.visible = shown
    },
    hide() {
      plane.visible = false
      particles.visible = false
    },
    dispose() {
      plane.geometry.dispose()
      ;(plane.material as ShaderMaterial).dispose()
      geometry.dispose()
      ;(particles.material as ShaderMaterial).dispose()
    },
  }
}

type Dissolve = ReturnType<typeof createDissolve>

export { createDissolve }
export type { Dissolve }
