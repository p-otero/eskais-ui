import type { SkyBackground, SkyScene, StreetFacades } from "@/components/ui/live-sky-backdrop"
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
import type { IdleJob } from "@/components/ui/live-sky-idle"
import {
  blurFragment,
  fullScreenVertex,
  glowFragment,
  lightingFragment,
} from "@/components/ui/live-sky-lighting-shaders"
import { photoGlowFragment, photoLightingFragment } from "@/components/ui/live-sky-photo-shaders"

type PhotoBackground = Extract<SkyBackground, { kind: "photo" }>

type Band = { from: number; to: number }

const glowDownscale = 4
const bandPixels = 49_152

function bandsOf(into: Target): Band[] {
  const rows = Math.max(1, Math.floor(bandPixels / Math.max(1, into.width)))
  const bands: Band[] = []
  for (let from = 0; from < into.height; from += rows) bands.push({ from, to: Math.min(into.height, from + rows) })
  return bands
}

/**
 * Lights what stands before the sky, the traced street or a photo, for one weather state into a texture, and blurs its
 * lit windows and lamps into a quarter-size glow for the bloom. It lights off screen a band per step and shows the
 * result whole at the end, so a weather change never costs one frame the entire pass.
 */
function createRelighter(gl: GL, screen: WebGLBuffer | null, noise: WebGLTexture | null) {
  const lighting = link(gl, fullScreenVertex, lightingFragment)
  const glow = link(gl, fullScreenVertex, glowFragment)
  const photoLighting = link(gl, fullScreenVertex, photoLightingFragment)
  const photoGlow = link(gl, fullScreenVertex, photoGlowFragment)
  const photo = texture(gl)
  const skyMask = texture(gl)
  const windows = texture(gl)
  const blur = link(gl, fullScreenVertex, blurFragment)
  const albedo = texture(gl, { nearest: true })
  const surface = texture(gl, { nearest: true })
  const place = texture(gl, { nearest: true })
  const skyline = texture(gl)
  let lit: [Target, Target] = [target(gl), target(gl)]
  let glows: [Target, Target, Target] = [target(gl), target(gl), target(gl)]
  const vertices = attributes(gl)
  let shown: SkyBackground | null = null
  let uploaded: SkyBackground | null = null

  const fullScreen = (program: ReturnType<typeof link>, into: Target, band?: Band) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, into.framebuffer)
    gl.viewport(0, 0, into.width, into.height)
    if (band) {
      gl.enable(gl.SCISSOR_TEST)
      gl.scissor(0, band.from, into.width, band.to - band.from)
    }
    gl.useProgram(program.program)
    gl.bindBuffer(gl.ARRAY_BUFFER, screen)
    vertices.bind(program, "a_corner", 2, 2, 0)
  }

  const release = () => {
    gl.disable(gl.SCISSOR_TEST)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  const lightStreet = (scene: SkyScene, street: StreetFacades, into: Target, band: Band) => {
    const { gbuffer } = street
    const { lighting: values, camera } = scene
    fullScreen(lighting, into, band)
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
    release()
  }

  const glowStreet = (scene: SkyScene, street: StreetFacades, into: Target) => {
    const values = scene.lighting
    fullScreen(glow, into)
    bindTextures(gl, glow, { u_albedo: albedo, u_surface: surface })
    gl.uniform2f(glow.uniform("u_source"), street.gbuffer.width, street.gbuffer.height)
    gl.uniform2f(glow.uniform("u_size"), into.width, into.height)
    gl.uniform1f(glow.uniform("u_litFraction"), values.litFraction)
    gl.uniform1f(glow.uniform("u_lamps"), values.street[0] > 0.02 ? 1 : 0)
    vertices.draw(3)
  }

  const lightPhoto = (scene: SkyScene, background: PhotoBackground, into: Target, band: Band) => {
    const values = scene.photoLighting
    fullScreen(photoLighting, into, band)
    bindTextures(gl, photoLighting, { u_photo: photo, u_skyMask: skyMask, u_windows: windows })
    const u = photoLighting.uniform
    gl.uniform2f(u("u_size"), into.width, into.height)
    gl.uniform1f(u("u_horizon"), background.horizon)
    gl.uniform1f(u("u_exposure"), values.exposure)
    gl.uniform1f(u("u_overcast"), values.overcast)
    gl.uniform1f(u("u_warmth"), values.warmth)
    gl.uniform3fv(u("u_warmTint"), values.warmTint)
    gl.uniform1f(u("u_night"), values.night)
    gl.uniform3fv(u("u_nightTint"), values.nightTint)
    gl.uniform3fv(u("u_streetLight"), values.streetLight)
    gl.uniform1f(u("u_wetness"), values.wetness)
    gl.uniform3fv(u("u_sheen"), values.sheen)
    gl.uniform1f(u("u_haze"), values.haze)
    gl.uniform3fv(u("u_hazeColour"), values.hazeColour)
    gl.uniform3fv(u("u_windowLight"), values.windowLight)
    gl.uniform1f(u("u_windowsOn"), values.windowsOn)
    vertices.draw(3)
    release()
  }

  const glowPhoto = (scene: SkyScene, background: PhotoBackground, into: Target) => {
    const values = scene.photoLighting
    fullScreen(photoGlow, into)
    bindTextures(gl, photoGlow, { u_windows: windows, u_skyMask: skyMask, u_photo: photo })
    gl.uniform2f(photoGlow.uniform("u_size"), into.width, into.height)
    gl.uniform3fv(photoGlow.uniform("u_streetLight"), values.streetLight)
    gl.uniform1f(photoGlow.uniform("u_night"), values.night)
    gl.uniform1f(photoGlow.uniform("u_horizon"), background.horizon)
    gl.uniform3fv(photoGlow.uniform("u_windowLight"), values.windowLight)
    gl.uniform1f(photoGlow.uniform("u_windowsOn"), values.windowsOn)
    vertices.draw(3)
  }

  const blurGlow = (into: Target, scratch: Target) => {
    for (const [from, onto, step] of [
      [into, scratch, [1, 0]],
      [scratch, into, [0, 1]],
    ] as const) {
      fullScreen(blur, onto)
      bindTextures(gl, blur, { u_image: from.texture })
      gl.uniform2f(blur.uniform("u_step"), step[0] / onto.width, step[1] / onto.height)
      gl.uniform2f(blur.uniform("u_size"), onto.width, onto.height)
      vertices.draw(3)
    }
    release()
  }

  function* uploads(background: SkyBackground): IdleJob {
    if (background.kind === "street") {
      const { gbuffer } = background
      upload(gl, skyline, background.skyline.cells, 1, background.skyline.bytes)
      for (const [into, bytes] of [
        [albedo, gbuffer.albedo],
        [surface, gbuffer.surface],
        [place, gbuffer.place],
      ] as const) {
        upload(gl, into, gbuffer.width, gbuffer.height, bytes)
        yield
      }
      return
    }
    for (const [into, source] of [
      [photo, background.layers.image],
      [skyMask, background.layers.sky],
      [windows, background.layers.windows],
    ] as const) {
      gl.bindTexture(gl.TEXTURE_2D, into)
      if (source) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4))
      yield
    }
  }

  return {
    lit: () => lit[0].texture,
    glow: () => glows[0].texture,
    /**
     * Lights `scene` over `background`, or over the background shown, off screen, yielding after each upload and each
     * band; the new light shows when the last step ends. A job dropped halfway leaves the light shown as it was.
     */
    *relight(scene: SkyScene, background: SkyBackground | null): IdleJob {
      const lighted = background ?? shown
      if (!lighted) return
      if (uploaded !== lighted) {
        uploaded = null
        yield* uploads(lighted)
        uploaded = lighted
      }
      const size = lighted.kind === "street" ? lighted.gbuffer : lighted
      const into = lit[1]
      resizeTarget(gl, into, size.width, size.height)
      for (const band of bandsOf(into)) {
        gl.disable(gl.BLEND)
        if (lighted.kind === "street") lightStreet(scene, lighted, into, band)
        else lightPhoto(scene, lighted, into, band)
        yield
      }
      const small = {
        width: Math.max(1, Math.ceil(size.width / glowDownscale)),
        height: Math.max(1, Math.ceil(size.height / glowDownscale)),
      }
      const [, glowInto, scratch] = glows
      resizeTarget(gl, glowInto, small.width, small.height)
      resizeTarget(gl, scratch, small.width, small.height)
      gl.disable(gl.BLEND)
      if (lighted.kind === "street") glowStreet(scene, lighted, glowInto)
      else glowPhoto(scene, lighted, glowInto)
      blurGlow(glowInto, scratch)
      yield
      lit = [lit[1], lit[0]]
      glows = [glows[1], glows[0], glows[2]]
      shown = lighted
    },
  }
}

export { createRelighter }
