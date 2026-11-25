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
import {
  blurFragment,
  fullScreenVertex,
  glowFragment,
  lightingFragment,
} from "@/components/ui/live-sky-lighting-shaders"
import type { PhotoLayers } from "@/components/ui/live-sky-photo"
import { photoGlowFragment, photoLightingFragment } from "@/components/ui/live-sky-photo-shaders"

type PhotoBackground = Extract<SkyBackground, { kind: "photo" }>

const glowDownscale = 4

/**
 * Lights what stands before the sky, the traced street or a photo, for one weather state into a texture, and blurs its
 * lit windows and lamps into a quarter-size glow for the bloom. Runs only when the weather or the background changes.
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
  const lit = target(gl)
  const glows: [Target, Target] = [target(gl), target(gl)]
  const vertices = attributes(gl)
  let background: SkyBackground | null = null

  const fullScreen = (program: ReturnType<typeof link>, into: Target) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, into.framebuffer)
    gl.viewport(0, 0, into.width, into.height)
    gl.useProgram(program.program)
    gl.bindBuffer(gl.ARRAY_BUFFER, screen)
    vertices.bind(program, "a_corner", 2, 2, 0)
  }

  const lightStreet = (scene: SkyScene, street: StreetFacades) => {
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
  }

  const lightPhoto = (scene: SkyScene, shown: PhotoBackground) => {
    const values = scene.photoLighting
    fullScreen(photoLighting, lit)
    bindTextures(gl, photoLighting, { u_photo: photo, u_skyMask: skyMask, u_windows: windows })
    const u = photoLighting.uniform
    gl.uniform2f(u("u_size"), lit.width, lit.height)
    gl.uniform1f(u("u_horizon"), shown.horizon)
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

    fullScreen(photoGlow, glows[0])
    bindTextures(gl, photoGlow, { u_windows: windows })
    gl.uniform2f(photoGlow.uniform("u_size"), glows[0].width, glows[0].height)
    gl.uniform3fv(photoGlow.uniform("u_windowLight"), values.windowLight)
    gl.uniform1f(photoGlow.uniform("u_windowsOn"), values.windowsOn)
    vertices.draw(3)
  }

  const blurGlow = () => {
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

  const uploadPhoto = (layers: PhotoLayers) => {
    for (const [into, source] of [
      [photo, layers.image],
      [skyMask, layers.sky],
      [windows, layers.windows],
    ] as const) {
      gl.bindTexture(gl.TEXTURE_2D, into)
      if (source) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4))
    }
  }

  return {
    lit: () => lit.texture,
    glow: () => glows[0].texture,
    ready: () => background !== null,
    setBackground(next: SkyBackground) {
      background = next
      const size = next.kind === "street" ? next.gbuffer : next
      if (next.kind === "street") {
        const { gbuffer } = next
        upload(gl, albedo, gbuffer.width, gbuffer.height, gbuffer.albedo)
        upload(gl, surface, gbuffer.width, gbuffer.height, gbuffer.surface)
        upload(gl, place, gbuffer.width, gbuffer.height, gbuffer.place)
        upload(gl, skyline, next.skyline.cells, 1, next.skyline.bytes)
      } else uploadPhoto(next.layers)
      resizeTarget(gl, lit, size.width, size.height)
      const small = {
        width: Math.max(1, Math.ceil(size.width / glowDownscale)),
        height: Math.max(1, Math.ceil(size.height / glowDownscale)),
      }
      for (const into of glows) resizeTarget(gl, into, small.width, small.height)
    },
    relight(scene: SkyScene) {
      if (!background) return
      if (background.kind === "street") lightStreet(scene, background)
      else lightPhoto(scene, background)
      blurGlow()
    },
  }
}

export { createRelighter }
