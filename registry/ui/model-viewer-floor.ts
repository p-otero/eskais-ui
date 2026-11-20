import { Color, DoubleSide, Mesh, PlaneGeometry, ShaderMaterial } from "three"

const vertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

// A grid and rings fading out from the feet, a contact shadow under them, and a pulse that runs out across the grid.
// The shadow darkens; the lines draw over it.
const fragment = /* glsl */ `
uniform vec3 lineColor;
uniform vec3 accent;
uniform float opacity;
uniform float pulse;
varying vec2 vUv;
void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  float r = length(p);
  vec2 cells = p * 7.0;
  vec2 grid = abs(fract(cells - 0.5) - 0.5) / fwidth(cells);
  float line = 1.0 - min(min(grid.x, grid.y), 1.0);
  float rings = 1.0 - min(abs(fract(r * 3.5) - 0.5) / fwidth(r * 3.5), 1.0);
  float fade = smoothstep(1.0, 0.1, r);
  float shadow = smoothstep(0.38, 0.0, length(p * vec2(1.0, 1.35)));
  float wave = pulse > 0.0 ? exp(-pow((r - pulse * 0.9) / 0.035, 2.0)) * (1.0 - pulse) : 0.0;
  vec3 color = mix(lineColor, accent, clamp(wave * 1.5, 0.0, 1.0));
  float ink = max(line * 0.22, rings * 0.12) * fade + wave * 0.8;
  vec3 shaded = mix(vec3(0.0), color, ink / max(ink + shadow * 0.28, 1e-4));
  gl_FragColor = vec4(shaded, (ink + shadow * 0.28) * opacity);
  #include <colorspace_fragment>
}
`

/**
 * A grid disc and a contact shadow under the model's feet, one draw call. `set` fades it and runs a pulse out from
 * the feet (0 to 1 across the disc); a frame writes only uniforms.
 */
function createFloor() {
  const uniforms = {
    lineColor: { value: new Color(0x888888) },
    accent: { value: new Color(0x3b82f6) },
    opacity: { value: 1 },
    pulse: { value: 0 },
  }
  const mesh = new Mesh(
    new PlaneGeometry(1, 1),
    new ShaderMaterial({
      uniforms,
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    }),
  )
  mesh.rotation.x = -Math.PI / 2
  mesh.renderOrder = -1
  mesh.visible = false
  return {
    mesh,
    /** Under a model `height` tall whose feet are at `y`, centred on `x`, `z`. */
    place(x: number, y: number, z: number, height: number) {
      mesh.position.set(x, y, z)
      mesh.scale.set(height * 1.6, height * 1.6, 1)
      mesh.visible = height > 0
    },
    /** The theme's line and accent colours. */
    colors(line: Color, accent: Color) {
      uniforms.lineColor.value.copy(line)
      uniforms.accent.value.copy(accent)
    },
    set({ opacity, pulse }: { opacity?: number; pulse?: number }) {
      if (opacity !== undefined) uniforms.opacity.value = opacity
      if (pulse !== undefined) uniforms.pulse.value = pulse
    },
    dispose() {
      mesh.geometry.dispose()
      ;(mesh.material as ShaderMaterial).dispose()
    },
  }
}

type ModelViewerFloor = ReturnType<typeof createFloor>

export { createFloor }
export type { ModelViewerFloor }
