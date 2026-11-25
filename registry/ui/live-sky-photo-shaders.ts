const photoLightingFragment = `
precision mediump float;
uniform sampler2D u_photo;
uniform sampler2D u_skyMask;
uniform sampler2D u_windows;
uniform vec2 u_size;
uniform float u_horizon;
uniform float u_exposure;
uniform float u_overcast;
uniform float u_warmth;
uniform vec3 u_warmTint;
uniform float u_night;
uniform vec3 u_nightTint;
uniform vec3 u_streetLight;
uniform float u_wetness;
uniform vec3 u_sheen;
uniform float u_haze;
uniform vec3 u_hazeColour;
uniform vec3 u_windowLight;
uniform float u_windowsOn;

void main() {
  vec2 uv = gl_FragCoord.xy / u_size;
  float foreground = 1.0 - texture2D(u_skyMask, uv).a;
  if (foreground < 0.004) {
    gl_FragColor = vec4(0.0);
    return;
  }
  vec3 colour = texture2D(u_photo, uv).rgb;
  float grey = dot(colour, vec3(0.2126, 0.7152, 0.0722));
  colour = mix(colour, vec3(grey), 0.45 * u_overcast);
  colour = mix(colour, vec3(0.42) + (colour - vec3(0.42)) * 0.72, u_overcast);
  colour *= mix(vec3(1.0), vec3(0.9, 0.96, 1.06), u_overcast);
  colour *= mix(vec3(1.0), u_warmTint, u_warmth);
  float below = smoothstep(u_horizon - 0.02, min(1.0, u_horizon + 0.35), uv.y);
  colour *= 1.0 - 0.32 * u_wetness * (0.35 + 0.65 * below);
  colour += u_sheen * u_wetness * below * (1.0 - grey) * 0.3;
  colour *= u_exposure;
  colour = mix(colour, colour * u_nightTint * 0.09, u_night);
  colour += u_streetLight * u_night * below * 0.16 * (0.4 + grey);
  colour += u_windowLight * texture2D(u_windows, uv).a * u_windowsOn;
  float far = 1.0 - smoothstep(u_horizon - 0.1, 1.0, uv.y) * 0.75;
  colour = mix(colour, u_hazeColour, clamp(u_haze * far, 0.0, 0.92));
  gl_FragColor = vec4(colour, foreground);
}
`

const photoGlowFragment = `
precision mediump float;
uniform sampler2D u_windows;
uniform vec2 u_size;
uniform vec3 u_windowLight;
uniform float u_windowsOn;
void main() {
  vec2 uv = gl_FragCoord.xy / u_size;
  gl_FragColor = vec4(u_windowLight * texture2D(u_windows, uv).a * u_windowsOn * 1.6, 1.0);
}
`

export { photoGlowFragment, photoLightingFragment }
