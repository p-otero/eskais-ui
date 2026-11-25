const backdropVertex = `
attribute vec2 a_corner;
void main() { gl_Position = vec4(a_corner, 0.0, 1.0); }
`

const backdropFragment = `
precision mediump float;
uniform sampler2D u_sky;
uniform sampler2D u_facades;
uniform sampler2D u_noise;
uniform vec2 u_size;
uniform float u_focal;
uniform vec3 u_forward;
uniform vec3 u_right;
uniform vec3 u_up;
uniform float u_base;
uniform float u_tile;
uniform vec2 u_offset;
uniform float u_threshold;
uniform float u_softness;
uniform float u_shadeBias;
uniform vec3 u_lit;
uniform vec3 u_shade;
uniform vec3 u_horizon;
uniform vec3 u_sunGlow;
uniform vec3 u_sun;
uniform float u_veil;
uniform vec3 u_veilColour;
uniform float u_sheets;
uniform vec2 u_sheetOffset;
uniform float u_flash;
uniform sampler2D u_glowMap;
uniform float u_bloom;
uniform vec2 u_sunStep;

float fbm(vec2 p) {
  return texture2D(u_noise, p).r * 0.55 + texture2D(u_noise, p * 2.13 + 0.31).g * 0.3 + texture2D(u_noise, p * 4.37 + 0.67).g * 0.15;
}

void main() {
  vec2 pixel = vec2(gl_FragCoord.x, u_size.y - gl_FragCoord.y);
  vec2 uv = pixel / u_size;
  vec3 colour = texture2D(u_sky, uv).rgb;
  vec3 ray = normalize(u_forward * u_focal + u_right * (pixel.x - u_size.x * 0.5) + u_up * (u_size.y * 0.5 - pixel.y));
  if (ray.y > 0.02) {
    float reach = u_base / ray.y / u_tile;
    vec2 at = ray.xz * reach + u_offset;
    float n = fbm(at);
    float density = smoothstep(u_threshold, u_threshold + u_softness, n);
    float thick = smoothstep(u_threshold, u_threshold + 0.3, n);
    float towardSun = texture2D(u_noise, at + u_sunStep).r - texture2D(u_noise, at).r;
    float sunSide = clamp(0.5 - towardSun * 6.0, 0.0, 1.0);
    float silver = pow(max(0.0, dot(ray, u_sun)), 6.0) * (1.0 - thick) * 1.6;
    vec3 body = mix(u_lit * 1.08, mix(u_lit, u_shade, u_shadeBias), thick);
    vec3 cloud = body + u_sunGlow * (sunSide * (1.0 - thick * 0.55) * 0.75 + silver);
    float far = smoothstep(0.04, 0.4, ray.y);
    colour = mix(colour, mix(u_horizon, cloud, far), density * (0.55 + 0.45 * far));
  }
  vec4 facade = texture2D(u_facades, uv);
  colour = mix(colour, facade.rgb, facade.a);
  float sheet = texture2D(u_noise, uv * vec2(0.7, 0.35) + u_sheetOffset).r;
  float veil = u_veil * mix(1.0, 0.35 + sheet * 1.3, u_sheets) * (1.0 - facade.a * 0.85);
  colour = mix(colour, u_veilColour, clamp(veil, 0.0, 0.9));
  colour += texture2D(u_glowMap, uv).rgb * u_bloom;
  colour += u_flash * vec3(0.82, 0.86, 1.0) * (1.0 - facade.a * 0.7);
  gl_FragColor = vec4(colour, 1.0);
}
`

const fallVertex = `
attribute vec4 a_seed;
attribute vec2 a_corner;
uniform float u_time;
uniform float u_period;
uniform vec3 u_velocity;
uniform float u_exposure;
uniform float u_depth;
uniform float u_diameter;
uniform float u_sway;
uniform vec2 u_tan;
uniform vec2 u_size;
uniform float u_focal;
uniform float u_snow;
varying vec2 v_corner;
varying float v_alpha;
varying float v_snow;

vec3 hash3(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}

vec2 toScreen(vec3 p) {
  return vec2(p.x / (p.z * u_tan.x), p.y / (p.z * u_tan.y));
}

void main() {
  float clock = u_time / u_period + a_seed.w;
  float phase = fract(clock);
  vec3 r = hash3(a_seed.xyz * 97.0 + floor(clock) * 1.618);
  float z = 0.5 + u_depth * pow(r.z, 1.35);
  vec3 velocity = u_velocity * (0.8 + 0.4 * a_seed.x);
  vec3 head = vec3((r.x * 2.0 - 1.0) * z * u_tan.x * 1.2, (r.y * 2.0 - 1.0) * z * u_tan.y * 1.2, z);
  head += velocity * (phase - 0.5) * u_period;
  head.x += u_sway * sin(u_time * 1.3 + a_seed.y * 40.0);
  head.y += u_sway * 0.5 * cos(u_time * 0.9 + a_seed.z * 31.0);
  vec3 tail = head - velocity * u_exposure;
  v_snow = u_snow;
  if (head.z < 0.35 || tail.z < 0.35) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    v_alpha = 0.0;
    v_corner = a_corner;
    return;
  }
  vec2 headPx = toScreen(head) * u_size * 0.5;
  vec2 tailPx = toScreen(tail) * u_size * 0.5;
  vec2 along = headPx - tailPx;
  float span = max(length(along), 0.001);
  vec2 direction = along / span;
  vec2 normal = vec2(-direction.y, direction.x);
  float width = u_diameter * u_focal / head.z;
  float drawn = max(width, 1.0);
  float coverage = min(1.0, width / drawn + 0.25);
  float reach = mix(0.0, span, a_corner.x) + (a_corner.x * 2.0 - 1.0) * drawn * 0.5 * u_snow;
  vec2 corner = tailPx + direction * reach + normal * a_corner.y * drawn * (0.5 + u_snow * 0.5);
  gl_Position = vec4(corner / (u_size * 0.5), 0.0, 1.0);
  float lifetime = smoothstep(0.0, 0.12, phase) * smoothstep(1.0, 0.88, phase);
  float depthFade = smoothstep(u_depth, u_depth * 0.6, head.z);
  v_alpha = lifetime * depthFade * coverage;
  v_corner = a_corner;
}
`

const fallFragment = `
precision mediump float;
uniform vec3 u_colour;
uniform float u_alpha;
uniform sampler2D u_glowMap;
uniform vec2 u_screen;
uniform float u_bloom;
varying vec2 v_corner;
varying float v_alpha;
varying float v_snow;
void main() {
  float across = 1.0 - v_corner.y * v_corner.y;
  float streak = across * mix(0.3, 1.0, v_corner.x);
  float flake = smoothstep(1.0, 0.2, length(vec2(v_corner.x * 2.0 - 1.0, v_corner.y)));
  float a = mix(streak, flake, v_snow) * v_alpha * u_alpha;
  vec2 at = vec2(gl_FragCoord.x / u_screen.x, 1.0 - gl_FragCoord.y / u_screen.y);
  vec3 lit = u_colour + texture2D(u_glowMap, at).rgb * (0.6 + u_bloom * 3.0);
  gl_FragColor = vec4(lit * a, a);
}
`

const dropVertex = `
attribute vec2 a_centre;
attribute vec2 a_corner;
attribute vec3 a_shape;
uniform vec2 u_size;
varying vec2 v_local;
varying vec2 v_centre;
varying float v_radius;
varying float v_alpha;
varying float v_splash;
void main() {
  vec2 position = a_centre + a_corner * vec2(a_shape.x, a_shape.x * 1.08);
  gl_Position = vec4(position / u_size * vec2(2.0, -2.0) + vec2(-1.0, 1.0), 0.0, 1.0);
  v_local = a_corner;
  v_centre = a_centre / u_size;
  v_radius = a_shape.x / u_size.y;
  v_alpha = a_shape.y;
  v_splash = a_shape.z;
}
`

const dropFragment = `
precision mediump float;
uniform sampler2D u_sky;
uniform sampler2D u_facades;
uniform sampler2D u_glowMap;
uniform float u_bloom;
uniform vec3 u_highlight;
varying vec2 v_local;
varying vec2 v_centre;
varying float v_radius;
varying float v_alpha;
varying float v_splash;
void main() {
  float d = length(v_local);
  if (d > 1.0) discard;
  if (v_splash > 0.5) {
    float ring = smoothstep(0.6, 0.85, d) * smoothstep(1.0, 0.88, d);
    float a = ring * v_alpha * 0.6;
    gl_FragColor = vec4(u_highlight * a, a);
    return;
  }
  float dome = sqrt(1.0 - d * d);
  vec3 normal = normalize(vec3(v_local, dome * 0.9));
  vec2 seen = clamp(mix(v_centre, vec2(0.5), 0.45) - v_local * 0.3, 0.0, 1.0);
  vec4 facade = texture2D(u_facades, seen);
  vec3 colour = mix(texture2D(u_sky, seen).rgb, facade.rgb, facade.a) * 1.12 + 0.03;
  colour += texture2D(u_glowMap, seen).rgb * (1.2 + u_bloom * 3.0);
  float shade = smoothstep(0.62, 1.0, d) * (0.25 + 0.4 * max(0.0, v_local.y));
  colour = mix(colour, colour * 0.45, shade);
  colour += smoothstep(0.75, 0.95, d) * max(0.0, -v_local.y) * u_highlight * 0.25;
  colour += pow(max(0.0, dot(normal, normalize(vec3(-0.3, -0.5, 0.8)))), 40.0) * u_highlight;
  float a = v_alpha * smoothstep(1.0, 0.88, d) * mix(0.6, 1.0, smoothstep(0.4, 0.95, d));
  gl_FragColor = vec4(colour * a, a);
}
`

export { backdropFragment, backdropVertex, dropFragment, dropVertex, fallFragment, fallVertex }
