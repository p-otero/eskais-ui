import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Mesh,
  NormalBlending,
  PlaneGeometry,
  Points,
  ShaderMaterial,
  SkinnedMesh,
  Vector3,
  type Material,
  type Object3D,
  type Texture,
} from "three"

// Perf: one draw call: every particle's path is a function of `progress` in the vertex shader, so a frame writes
// only uniforms.

const planeVertex = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const timing = `
float liftOf(vec2 spot) { return 0.03 + (1.0 - spot.y) * 0.22; }
const float flight = 0.46;
// The shimmer runs down the body behind the landings, top first; ModelScan's model is revealed under it (shimmerY).
float shimmerOf(float h) { return 0.6 + (1.0 - h) * 0.2; }
`

const photoFragment = `
uniform sampler2D map;
uniform float opacity;
uniform float progress;
varying vec2 vUv;
${timing}
void main() {
  vec4 color = texture2D(map, vUv);
  float gone = smoothstep(liftOf(vUv), liftOf(vUv) + 0.07, progress);
  gl_FragColor = vec4(color.rgb, color.a * opacity * (1.0 - gone));
  #include <colorspace_fragment>
}
`

const cloudVertex = `
attribute vec2 spot;
attribute vec3 goal;
attribute vec3 tint;
attribute vec4 seed;
uniform sampler2D map;
uniform float progress;
uniform vec3 origin;
uniform vec2 size;
uniform float pointSize;
uniform vec3 accent;
uniform vec3 axis;
uniform float floorY;
uniform float height;
uniform float focus;
uniform float additive;
varying vec3 vColor;
varying float vAlpha;
varying float vGlow;
${timing}

vec3 bezier(vec3 a, vec3 b, vec3 c, vec3 d, float t) {
  float s = 1.0 - t;
  return s * s * s * a + 3.0 * s * s * t * b + 3.0 * s * t * t * c + t * t * t * d;
}

vec3 turnY(vec3 p, float angle) {
  vec3 q = p - axis;
  float c = cos(angle);
  float s = sin(angle);
  return axis + vec3(c * q.x + s * q.z, q.y, -s * q.x + c * q.z);
}

void main() {
  vec3 start = origin + vec3((spot - 0.5) * size, 0.0);
  vec3 photo = texture2D(map, spot).rgb;
  float lift = liftOf(spot) + seed.x * 0.06;
  float k = clamp((progress - lift) / flight, 0.0, 1.0);
  float e = 1.0 - pow(1.0 - k, 3.0);
  vec3 position;
  vec3 color;
  float alpha;
  float scale;
  float glow = 0.0;
  if (seed.w > 0.5) {
    // Out towards the camera and away from the body's axis, then in onto the surface from outside it.
    vec3 out1 = normalize(vec3(start.x - axis.x, 0.0, 0.0) + vec3(0.0, 0.0, 1.0)) * height * (0.18 + 0.12 * seed.z);
    vec3 radial = goal - vec3(axis.x, goal.y, axis.z);
    vec3 out2 = (length(radial) > 1e-4 ? normalize(radial) : vec3(0.0, 0.0, 1.0)) * height * (0.14 + 0.1 * seed.y);
    vec3 path = bezier(start, start + out1 + vec3(0.0, height * 0.05, 0.0), goal + out2 + vec3(0.0, height * 0.04, 0.0), goal, e);
    float swirl = (seed.y > 0.5 ? 1.0 : -1.0) * (0.9 + 0.6 * seed.z) * sin(3.14159 * e) * (1.0 - e);
    position = turnY(path, swirl);
    // Photo colour, the accent mid-flight, the surface's own colour on landing.
    color = mix(mix(photo, accent, smoothstep(0.0, 0.4, e)), tint, smoothstep(0.62, 1.0, e));
    float h = clamp((goal.y - floorY) / height, 0.0, 1.0);
    float shimmerAt = shimmerOf(h);
    float shimmer = exp(-pow((progress - shimmerAt) / 0.022, 2.0));
    color = mix(color, accent * mix(1.4, 1.0, additive) + mix(0.15, 0.0, additive), shimmer * mix(0.45, 0.55, additive));
    glow = shimmer;
    alpha = smoothstep(0.0, 0.05, k) * (1.0 - smoothstep(shimmerAt, shimmerAt + 0.04, progress));
    scale = mix(1.0, 0.7, e) * (1.0 + shimmer * 0.7);
  } else {
    vec3 away = vec3((spot.x - 0.5) * 0.6, seed.z * 0.2 - 0.05, 0.25 + seed.x * 0.25);
    position = start + away * height * 0.3 * e;
    color = mix(photo, accent, 0.3 * e);
    alpha = smoothstep(0.0, 0.05, k) * (1.0 - smoothstep(0.05, 0.45, k)) * 0.55;
    scale = 1.0 + 0.2 * e;
  }
  vec4 view = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * view;
  // A lens's focus: further from the focal plane, bigger and fainter.
  float blur = clamp(abs(-view.z - focus) / focus * 3.0, 0.0, 1.0);
  gl_PointSize = pointSize * scale * (1.0 + blur * 0.8) / -view.z;
  vColor = color;
  vAlpha = alpha / (1.0 + blur * 2.5);
  vGlow = glow;
}
`

const cloudFragment = `
uniform float additive;
varying vec3 vColor;
varying float vAlpha;
varying float vGlow;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  // A solid disc with a soft rim on a light stage; a gaussian glow, added up, on a dark one.
  float disc = 1.0 - smoothstep(0.55, 1.0, d);
  float glow = exp(-d * d * 4.0);
  float core = exp(-d * d * 16.0);
  vec3 color = vColor * (1.0 + core * (0.2 + vGlow * 0.6) * additive);
  float a = vAlpha * mix(disc, glow * 0.55, additive);
  // Premultiplied when additive, so overlapping sprites brighten instead of turning white at once.
  gl_FragColor = vec4(color * mix(1.0, a, additive), a);
  #include <colorspace_fragment>
}
`

/** Where the shimmer is at `progress`, as a fraction of the model's height from its feet: the shader's shimmerOf. */
const shimmerHeight = (progress: number) => Math.min(1, Math.max(0, 1 - (progress - 0.6) / 0.2))

const seeded = (start: number) => {
  let seed = start
  return () => {
    seed = (seed * 16_807) % 2_147_483_647
    return seed / 2_147_483_647
  }
}

function surfacePoints(root: Object3D, count: number) {
  root.updateMatrixWorld(true)
  const meshes: Mesh[] = []
  root.traverse((object) => {
    if (object instanceof Mesh && !(object.userData as { outline?: boolean }).outline) meshes.push(object)
  })
  const triangles: { mesh: Mesh; a: number; b: number; c: number }[] = []
  const areas: number[] = []
  const [pa, pb, pc] = [new Vector3(), new Vector3(), new Vector3()]
  let total = 0
  for (const mesh of meshes) {
    if (mesh instanceof SkinnedMesh) mesh.skeleton.update()
    const geometry = mesh.geometry
    const position = geometry.getAttribute("position")
    const index = geometry.getIndex()
    const corners = index ? index.count : position.count
    for (let i = 0; i + 2 < corners; i += 3) {
      const [a, b, c] = index ? [index.getX(i), index.getX(i + 1), index.getX(i + 2)] : [i, i + 1, i + 2]
      pa.fromBufferAttribute(position, a)
      pb.fromBufferAttribute(position, b)
      pc.fromBufferAttribute(position, c)
      total += pb.sub(pa).cross(pc.sub(pa)).length() / 2
      triangles.push({ mesh, a, b, c })
      areas.push(total)
    }
  }
  const points = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3).fill(1)
  if (total === 0) return { points, colors }
  const random = seeded(11)
  const tint = new Color()
  const [ca, cb, cc] = [new Color(), new Color(), new Color()]
  for (let i = 0; i < count; i += 1) {
    const pick = random() * total
    let low = 0
    let high = areas.length - 1
    while (low < high) {
      const mid = (low + high) >> 1
      if ((areas[mid] ?? 0) < pick) low = mid + 1
      else high = mid
    }
    const { mesh, a, b, c } = triangles[low]!
    mesh.getVertexPosition(a, pa)
    mesh.getVertexPosition(b, pb)
    mesh.getVertexPosition(c, pc)
    let u = random()
    let v = random()
    if (u + v > 1) {
      u = 1 - u
      v = 1 - v
    }
    pa.multiplyScalar(1 - u - v)
      .addScaledVector(pb, u)
      .addScaledVector(pc, v)
      .applyMatrix4(mesh.matrixWorld)
    points.set([pa.x, pa.y, pa.z], i * 3)
    const vertexColors = (mesh.geometry as BufferGeometry).getAttribute("color")
    const material = [mesh.material].flat()[0] as (Material & { color?: Color }) | undefined
    tint.set(material?.color ?? 0xffffff)
    if (vertexColors) {
      ca.fromBufferAttribute(vertexColors, a)
      cb.fromBufferAttribute(vertexColors, b)
      cc.fromBufferAttribute(vertexColors, c)
      tint.multiply(
        ca
          .multiplyScalar(1 - u - v)
          .add(cb.multiplyScalar(u))
          .add(cc.multiplyScalar(v)),
      )
    }
    colors.set([tint.r, tint.g, tint.b], i * 3)
  }
  return { points, colors }
}

function pairByBands(cells: number[], spots: Float32Array, goals: Float32Array, bands = 56) {
  const order = cells.toSorted((a, b) => (spots[a * 2 + 1] ?? 0) - (spots[b * 2 + 1] ?? 0))
  const targets = Array.from({ length: cells.length }, (_, i) => i).toSorted(
    (a, b) => (goals[a * 3 + 1] ?? 0) - (goals[b * 3 + 1] ?? 0),
  )
  const pairs = new Map<number, number>()
  const per = Math.ceil(cells.length / bands)
  for (let start = 0; start < cells.length; start += per) {
    const band = order.slice(start, start + per).toSorted((a, b) => (spots[a * 2] ?? 0) - (spots[b * 2] ?? 0))
    const goalBand = targets.slice(start, start + per).toSorted((a, b) => (goals[a * 3] ?? 0) - (goals[b * 3] ?? 0))
    band.forEach((cell, i) => pairs.set(cell, goalBand[i] ?? 0))
  }
  return pairs
}

const columns = 150
// Perf: skinned surface samples are the costly part of building the cloud; particles share them, each a little apart.
const surfaceSamples = 5000

function spread(
  samples: { points: Float32Array; colors: Float32Array },
  count: number,
  jitter: number,
  random: () => number,
) {
  const have = samples.points.length / 3
  if (have >= count || have === 0) return samples
  const points = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  for (let i = 0; i < count; i += 1) {
    const from = (i % have) * 3
    for (let axis = 0; axis < 3; axis += 1) {
      points[i * 3 + axis] = (samples.points[from + axis] ?? 0) + (random() - 0.5) * 2 * jitter
      colors[i * 3 + axis] = samples.colors[from + axis] ?? 1
    }
  }
  return { points, colors }
}

/** The cloud's grid: `columns` across the photo, rows by its ratio. */
const cloudGrid = (ratio: number) => ({ columns, rows: Math.max(1, Math.round(columns / ratio)) })

type CloudOptions = {
  texture: Texture
  ratio: number
  accent: Color
  model: Object3D
  /** How much each grid cell is the person, 0 to 1, rows from the bottom (`personCells`); null for the photo alone. */
  person: Float32Array | null
  /** The model's feet, height and vertical axis, in world units. */
  bounds: { center: Vector3; size: Vector3 }
  /** Glowing additive sprites, for a dark stage. */
  dark: boolean
}

/**
 * The photo on a plane, and the cloud its pixels fly in. `set(progress)` plays it from 0 to 1; without `person`
 * there are no particles, only the photo to crossfade with `fade`.
 */
function createCloud({ texture, ratio, accent, model, person, bounds, dark }: CloudOptions) {
  const { rows } = cloudGrid(ratio)
  const cells: number[] = []
  const background: number[] = []
  const random = seeded(23)
  const total = person ? columns * rows : 0
  for (let i = 0; i < total; i += 1) {
    if ((person?.[i] ?? 0) >= 0.5) cells.push(i)
    else if (random() < 0.34) background.push(i)
  }
  const people = cells.length * 2
  const count = people + background.length
  const spots = new Float32Array(count * 2)
  const spotOf = (cell: number, jitter: boolean) => [
    ((cell % columns) + (jitter ? random() : 0.5)) / columns,
    (Math.floor(cell / columns) + (jitter ? random() : 0.5)) / rows,
  ]
  cells.forEach((cell, i) => {
    spots.set(spotOf(cell, true), i * 4)
    spots.set(spotOf(cell, true), i * 4 + 2)
  })
  background.forEach((cell, i) => spots.set(spotOf(cell, false), (people + i) * 2))
  const indices = Array.from({ length: people }, (_, i) => i)
  const surface =
    people > 0
      ? spread(surfacePoints(model, Math.min(people, surfaceSamples)), people, bounds.size.y * 0.006, random)
      : { points: new Float32Array(), colors: new Float32Array() }
  const pairs = pairByBands(indices, spots, surface.points)
  const goals = new Float32Array(count * 3)
  const tints = new Float32Array(count * 3)
  const seeds = new Float32Array(count * 4)
  for (let i = 0; i < count; i += 1) {
    const goal = pairs.get(i)
    if (goal !== undefined) {
      goals.set(surface.points.subarray(goal * 3, goal * 3 + 3), i * 3)
      tints.set(surface.colors.subarray(goal * 3, goal * 3 + 3), i * 3)
    }
    seeds.set([random(), random(), random(), goal === undefined ? 0 : 1], i * 4)
  }
  const uniforms = {
    map: { value: texture },
    progress: { value: 0 },
    opacity: { value: 1 },
    accent: { value: accent.clone() },
    origin: { value: new Vector3() },
    size: { value: [1, 1] },
    pointSize: { value: 1 },
    axis: { value: new Vector3(bounds.center.x, 0, bounds.center.z) },
    floorY: { value: bounds.center.y - bounds.size.y / 2 },
    height: { value: bounds.size.y },
    focus: { value: 1 },
    additive: { value: dark ? 1 : 0 },
  }
  const photo = new Mesh(
    new PlaneGeometry(1, 1),
    new ShaderMaterial({
      uniforms,
      vertexShader: planeVertex,
      fragmentShader: photoFragment,
      transparent: true,
      depthTest: false,
    }),
  )
  photo.renderOrder = 1
  const geometry = new BufferGeometry()
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(count * 3), 3))
  geometry.setAttribute("spot", new BufferAttribute(spots, 2))
  geometry.setAttribute("goal", new BufferAttribute(goals, 3))
  geometry.setAttribute("tint", new BufferAttribute(tints, 3))
  geometry.setAttribute("seed", new BufferAttribute(seeds, 4))
  const cloud = new Points(
    geometry,
    new ShaderMaterial({
      uniforms,
      vertexShader: cloudVertex,
      fragmentShader: cloudFragment,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: dark ? AdditiveBlending : NormalBlending,
      premultipliedAlpha: dark,
    }),
  )
  cloud.frustumCulled = false
  cloud.renderOrder = 2
  cloud.visible = count > 0
  const material = cloud.material as ShaderMaterial
  return {
    objects: [photo, cloud] as Object3D[],
    particles: count,
    people,
    place(center: Vector3, width: number, height: number, pixels: number, focus: number) {
      photo.position.copy(center)
      photo.scale.set(width, height, 1)
      uniforms.origin.value.copy(center)
      uniforms.size.value = [width, height]
      uniforms.pointSize.value = (width / columns) * pixels * 1.5
      uniforms.focus.value = focus
    },
    set(progress: number) {
      uniforms.progress.value = progress
    },
    theme(next: Color, onDark: boolean) {
      uniforms.accent.value.copy(next)
      uniforms.additive.value = onDark ? 1 : 0
      const blending = onDark ? AdditiveBlending : NormalBlending
      if (material.blending === blending) return
      material.blending = blending
      material.premultipliedAlpha = onDark
      material.needsUpdate = true
    },
    fade(opacity: number) {
      uniforms.opacity.value = opacity
      cloud.visible = false
    },
    hide() {
      photo.visible = false
      cloud.visible = false
    },
    dispose() {
      photo.geometry.dispose()
      ;(photo.material as ShaderMaterial).dispose()
      geometry.dispose()
      ;(cloud.material as ShaderMaterial).dispose()
    },
  }
}

type Cloud = ReturnType<typeof createCloud>

export { cloudGrid, createCloud, shimmerHeight }
export type { Cloud }
