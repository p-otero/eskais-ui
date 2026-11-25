import type { SkyScene, StreetFacades } from "@/components/ui/live-sky-backdrop"
import { placeLengthM, placeStartM } from "@/components/ui/live-sky-gbuffer"
import {
  attributes,
  bindTextures,
  link,
  resizeTarget,
  target,
  texture,
  upload,
  type GL,
  type Target,
} from "@/components/ui/live-sky-gl"
import {
  blurFragment,
  fullScreenVertex,
  glowFragment,
  lightingFragment,
} from "@/components/ui/live-sky-lighting-shaders"

const glowDownscale = 4

/**
 * Lights the traced street for one weather state into a texture, and blurs its windows and lamps into a quarter-size
 * glow for the bloom. Runs only when the weather or the street changes, never per frame.
 */
function createRelighter(gl: GL, screen: WebGLBuffer | null, noise: WebGLTexture | null) {
  const lighting = link(gl, fullScreenVertex, lightingFragment)
  const glow = link(gl, fullScreenVertex, glowFragment)
  const blur = link(gl, fullScreenVertex, blurFragment)
  const albedo = texture(gl, { nearest: true })
  const surface = texture(gl, { nearest: true })
  const place = texture(gl, { nearest: true })
  const skyline = texture(gl)
  const lit = target(gl)
  const glows: [Target, Target] = [target(gl), target(gl)]
  const vertices = attributes(gl)
  let facades: StreetFacades | null = null

  const fullScreen = (program: ReturnType<typeof link>, into: Target) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, into.framebuffer)
    gl.viewport(0, 0, into.width, into.height)
    gl.useProgram(program.program)
    gl.bindBuffer(gl.ARRAY_BUFFER, screen)
    vertices.bind(program, "a_corner", 2, 2, 0)
  }

  const light = (scene: SkyScene, street: StreetFacades) => {
    const { gbuffer } = street
    const { lighting: values, camera } = scene
    fullScreen(lighting, lit)
    bindTextures(gl, lighting, {
      u_albedo: albedo,
      u_surface: surface,
      u_place: place,
      u_skyline: skyline,
      u_noise: noise,
    })
    const u = lighting.uniform
    gl.uniform2f(u("u_size"), gbuffer.width, gbuffer.height)
    gl.uniform1f(u("u_focal"), (camera.focal * gbuffer.width) / camera.width)
    gl.uniform3f(u("u_forward"), camera.forward.x, camera.forward.y, camera.forward.z)
    gl.uniform3f(u("u_right"), camera.right.x, camera.right.y, camera.right.z)
    gl.uniform3f(u("u_up"), camera.up.x, camera.up.y, camera.up.z)
    gl.uniform3f(u("u_sun"), values.sun.x, values.sun.y, values.sun.z)
    gl.uniform3fv(u("u_sunColour"), values.sunColour)
    gl.uniform3fv(u("u_skyFill"), values.skyFill)
    gl.uniform3fv(u("u_bounce"), values.bounce)
    gl.uniform3fv(u("u_street"), values.street)
    gl.uniform3fv(u("u_haze"), values.haze)
    gl.uniform3fv(u("u_zenith"), values.zenith)
    gl.uniform3fv(u("u_horizon"), values.horizon)
    gl.uniform3fv(u("u_glow"), values.glow)
    gl.uniform1f(u("u_glowStrength"), values.glowStrength)
    gl.uniform1f(u("u_litFraction"), values.litFraction)
    gl.uniform1f(u("u_wetness"), values.wetness)
    gl.uniform1f(u("u_streaks"), values.streaks)
    gl.uniform1f(u("u_hazeDensity"), values.hazeDensity)
    gl.uniform1f(u("u_halfWidth"), street.halfWidth)
    gl.uniform2f(u("u_skylineSpan"), street.skyline.startM, street.skyline.lengthM)
    gl.uniform2f(u("u_placeSpan"), placeStartM, placeLengthM)
    vertices.draw(3)

    fullScreen(glow, glows[0])
    bindTextures(gl, glow, { u_albedo: albedo, u_surface: surface })
    gl.uniform2f(glow.uniform("u_source"), gbuffer.width, gbuffer.height)
    gl.uniform2f(glow.uniform("u_size"), glows[0].width, glows[0].height)
    gl.uniform1f(glow.uniform("u_litFraction"), values.litFraction)
    gl.uniform1f(glow.uniform("u_lamps"), values.street[0] > 0.02 ? 1 : 0)
    vertices.draw(3)

    for (const [from, into, step] of [
      [glows[0], glows[1], [1, 0]],
      [glows[1], glows[0], [0, 1]],
    ] as const) {
      fullScreen(blur, into)
      bindTextures(gl, blur, { u_image: from.texture })
      gl.uniform2f(blur.uniform("u_step"), step[0] / into.width, step[1] / into.height)
      gl.uniform2f(blur.uniform("u_size"), into.width, into.height)
      vertices.draw(3)
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  return {
    lit: () => lit.texture,
    glow: () => glows[0].texture,
    ready: () => facades !== null,
    setFacades(next: StreetFacades) {
      facades = next
      const { gbuffer } = next
      upload(gl, albedo, gbuffer.width, gbuffer.height, gbuffer.albedo)
      upload(gl, surface, gbuffer.width, gbuffer.height, gbuffer.surface)
      upload(gl, place, gbuffer.width, gbuffer.height, gbuffer.place)
      upload(gl, skyline, next.skyline.cells, 1, next.skyline.bytes)
      resizeTarget(gl, lit, gbuffer.width, gbuffer.height)
      const small = {
        width: Math.max(1, Math.ceil(gbuffer.width / glowDownscale)),
        height: Math.max(1, Math.ceil(gbuffer.height / glowDownscale)),
      }
      for (const into of glows) resizeTarget(gl, into, small.width, small.height)
    },
    relight(scene: SkyScene) {
      if (facades) light(scene, facades)
    },
  }
}

export { createRelighter }
