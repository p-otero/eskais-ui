const precisionHigh = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
`

const fullScreenVertex = `
attribute vec2 a_corner;
void main() { gl_Position = vec4(a_corner, 0.0, 1.0); }
`

const decodeSurface = `
vec3 normalOf(float code, float side) {
  if (code < 0.5) return vec3(-side, 0.0, 0.0);
  if (code < 1.5) return vec3(0.0, 1.0, 0.0);
  if (code < 2.5) return vec3(0.0, -1.0, 0.0);
  if (code < 3.5) return vec3(0.0, 0.0, 1.0);
  return vec3(0.0, 0.0, -1.0);
}
float codeOf(float channel, float step) { return floor(channel * 255.0 / step + 0.5); }
`

const lightingFragment = `${precisionHigh}
uniform sampler2D u_albedo;
uniform sampler2D u_surface;
uniform sampler2D u_place;
uniform sampler2D u_skyline;
uniform sampler2D u_noise;
uniform vec2 u_size;
uniform float u_focal;
uniform vec3 u_forward;
uniform vec3 u_right;
uniform vec3 u_up;
uniform vec3 u_sun;
uniform vec3 u_sunColour;
uniform vec3 u_skyFill;
uniform vec3 u_bounce;
uniform vec3 u_street;
uniform vec3 u_haze;
uniform vec3 u_zenith;
uniform vec3 u_horizon;
uniform vec3 u_glow;
uniform float u_glowStrength;
uniform float u_litFraction;
uniform float u_wetness;
uniform float u_streaks;
uniform float u_hazeDensity;
uniform float u_halfWidth;
uniform vec2 u_skylineSpan;
uniform vec2 u_placeSpan;
${decodeSurface}
vec3 skyAt(vec3 d) {
  float e = max(d.y, 0.0);
  vec3 base = mix(u_horizon, u_zenith, pow(e, 0.55));
  float a = acos(clamp(dot(d, u_sun), -1.0, 1.0));
  float sunward = 0.5 + 0.5 * dot(normalize(vec2(d.x, d.z) + 1e-4), normalize(vec2(u_sun.x, u_sun.z) + 1e-4));
  return base + u_glow * u_glowStrength * ((exp(-a * 1.1) * 0.7 + exp(-a * 6.0) * 0.6) * (1.0 - e * 0.4) + 0.22 * sunward * (1.0 - e * 0.6));
}

float sunReaches(vec3 n, float side, float north, float height) {
  float facing = max(0.0, dot(n, u_sun));
  if (facing <= 0.0) return 0.0;
  float travel = (2.0 * u_halfWidth + 1.0) / max(0.02, abs(u_sun.x));
  vec4 roofs = texture2D(u_skyline, vec2((north + u_sun.z * travel - u_skylineSpan.x) / u_skylineSpan.y, 0.5));
  float across = (side < 0.0 ? roofs.g : roofs.r) * 255.0 / 4.0;
  return facing * smoothstep(-0.8, 0.8, height + u_sun.y * travel - across);
}

void main() {
  vec2 pixel = gl_FragCoord.xy;
  vec2 uv = pixel / u_size;
  vec4 albedo = texture2D(u_albedo, uv);
  if (albedo.a < 0.5) {
    gl_FragColor = vec4(0.0);
    return;
  }
  vec4 surface = texture2D(u_surface, uv);
  vec4 place = texture2D(u_place, uv);
  vec3 ray = normalize(u_forward * u_focal + u_right * (pixel.x - u_size.x * 0.5) + u_up * (u_size.y * 0.5 - pixel.y));
  float side = ray.x < 0.0 ? -1.0 : 1.0;
  vec3 n = normalOf(codeOf(surface.r, 50.0), side);
  float occlusion = surface.g;
  float finish = codeOf(surface.b, 40.0);
  float rank = surface.a;
  float north = (place.r * 255.0 * 256.0 + place.g * 255.0) / 65535.0 * u_placeSpan.y + u_placeSpan.x;
  float distance = place.b * 255.0 * 2.0;
  float height = place.a * 255.0 / 4.0;
  bool lit = rank > 0.0 && rank <= u_litFraction;
  float down = step(n.y, -0.5);
  vec3 ambient = u_skyFill * occlusion * mix(1.0, 0.45, down) + u_bounce * occlusion * mix(0.25, 1.0, down);
  vec3 streetWash = u_street * exp(-height / 7.0) * mix(1.0, 1.7, down);
  vec3 diffuse = albedo.rgb * (ambient + streetWash + u_sunColour * sunReaches(n, side, north, height));
  vec3 bounced = reflect(ray, n);
  vec3 env = skyAt(vec3(bounced.x, max(bounced.y, 0.04), bounced.z));
  float fresnel = 0.04 + 0.96 * pow(1.0 - abs(dot(ray, n)), 5.0);
  vec3 colour;
  if (finish > 0.5 && finish < 1.5) {
    vec3 interior = albedo.rgb * (lit ? 0.95 : 0.06 + 0.06 * u_skyFill.g) * occlusion;
    float shine = clamp(0.32 + fresnel * 0.8, 0.0, 0.92) * (lit ? 0.45 : 1.0);
    colour = mix(interior, env * 0.92, shine);
  } else if (finish > 1.5 && finish < 2.5) {
    colour = diffuse + (lit ? albedo.rgb * vec3(1.0, 0.82, 0.56) * 0.6 : vec3(0.0));
  } else if (finish > 2.5 && finish < 3.5) {
    colour = diffuse * (1.0 - 0.2 * u_wetness) + env * fresnel * (0.3 + 0.5 * u_wetness);
  } else if (finish > 3.5 && finish < 4.5) {
    colour = albedo.rgb * (0.5 + 2.6 * u_street.r);
  } else if (finish > 4.5) {
    colour = mix(diffuse, env, 0.22 + fresnel * 0.5);
  } else {
    colour = diffuse * (1.0 - 0.4 * u_wetness);
    float streak = texture2D(u_noise, vec2(north * 0.85, height * 0.02)).g;
    float runs = smoothstep(0.6 - 0.2 * u_streaks, 0.66 - 0.2 * u_streaks, streak);
    float sheen = u_wetness * (0.16 + 0.34 * runs) * mix(1.0, 0.2, down);
    colour += env * sheen * (fresnel * 2.4 + 0.07) + env * runs * u_wetness * u_streaks * 0.12;
  }
  colour = mix(colour, u_haze, 1.0 - exp(-distance * u_hazeDensity));
  gl_FragColor = vec4(colour, 1.0);
}
`

const glowFragment = `${precisionHigh}
uniform sampler2D u_albedo;
uniform sampler2D u_surface;
uniform vec2 u_source;
uniform vec2 u_size;
uniform float u_litFraction;
uniform float u_lamps;
${decodeSurface}
void main() {
  vec3 sum = vec3(0.0);
  vec2 cell = u_source / u_size;
  vec2 origin = floor(gl_FragCoord.xy) * cell;
  for (int dy = 0; dy < 4; dy++) {
    for (int dx = 0; dx < 4; dx++) {
      vec2 uv = (origin + (vec2(float(dx), float(dy)) + 0.5) * cell / 4.0) / u_source;
      vec4 surface = texture2D(u_surface, uv);
      float finish = codeOf(surface.b, 40.0);
      vec3 albedo = texture2D(u_albedo, uv).rgb;
      bool lit = surface.a > 0.0 && surface.a <= u_litFraction;
      if (finish > 3.5 && finish < 4.5) sum += albedo * 3.0 * u_lamps;
      else if (lit && finish > 0.5 && finish < 2.5) sum += albedo * (finish < 1.5 ? 1.0 : 0.55);
    }
  }
  gl_FragColor = vec4(sum / 16.0, 1.0);
}
`

const blurFragment = `
precision mediump float;
uniform sampler2D u_image;
uniform vec2 u_step;
uniform vec2 u_size;
void main() {
  vec2 uv = gl_FragCoord.xy / u_size;
  vec3 sum = texture2D(u_image, uv).rgb * 0.2;
  sum += (texture2D(u_image, uv + u_step).rgb + texture2D(u_image, uv - u_step).rgb) * 0.17;
  sum += (texture2D(u_image, uv + u_step * 2.0).rgb + texture2D(u_image, uv - u_step * 2.0).rgb) * 0.12;
  sum += (texture2D(u_image, uv + u_step * 3.5).rgb + texture2D(u_image, uv - u_step * 3.5).rgb) * 0.07;
  sum += (texture2D(u_image, uv + u_step * 5.5).rgb + texture2D(u_image, uv - u_step * 5.5).rgb) * 0.04;
  gl_FragColor = vec4(sum, 1.0);
}
`

export { blurFragment, fullScreenVertex, glowFragment, lightingFragment }
