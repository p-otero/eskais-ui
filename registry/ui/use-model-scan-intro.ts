import { useFrame, useThree } from "@react-three/fiber"
import { use, useEffect, useMemo, useRef, useState } from "react"
import { Color, SRGBColorSpace, TextureLoader, type PerspectiveCamera, type Texture } from "three"

import { createDissolve } from "@/components/ui/model-scan-dissolve"
import { containSize, viewSizeAt } from "@/components/ui/model-viewer-math"
import type { ModelViewerHandle } from "@/components/ui/model-viewer-primitive"
import { ModelViewerSceneContext } from "@/components/ui/model-viewer-rig"

// Seconds: the photo burns away while the camera turns, or crossfades under reduced motion.
const flight = 2.6
const crossfade = 0.7

const smoothstep = (from: number, to: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)))
  return t * t * (3 - 2 * t)
}

/** A theme colour as three.js reads it: the canvas paints the token, whatever colour space it's written in. */
function tokenColor(element: Element, name: string) {
  const value = getComputedStyle(element).getPropertyValue(name).trim()
  const canvas = element.ownerDocument.createElement("canvas")
  canvas.width = 1
  canvas.height = 1
  const context = canvas.getContext("2d")
  if (!value || !context) return new Color(0x3b82f6)
  context.fillStyle = value
  context.fillRect(0, 0, 1, 1)
  const [r = 0, g = 0, b = 0] = context.getImageData(0, 0, 1, 1).data
  return new Color().setRGB(r / 255, g / 255, b / 255, SRGBColorSpace)
}

// The chosen view becomes the three-quarter one, and the camera turns there even if it was chosen already.
function turn(handle: ModelViewerHandle) {
  handle.api.setView("three-quarter")
  handle.api.aim("three-quarter")
}

type IntroOptions = {
  src: string
  /** The photo's width over its height. */
  ratio: number
  /** The 3D photo matches the 2D one: the 2D layer can go. */
  onHandOff: () => void
  /** The model has taken the photo's place. */
  onDone: () => void
}

/**
 * The photo on a plane where the front camera sees it exactly as the 2D photo was drawn, then, once the model has
 * loaded, the camera turns to the three-quarter view while the photo burns into particles and the model fades in
 * where it stood. Under reduced motion the photo crossfades into the model and the camera jumps after.
 */
function useModelScanIntro({ src, ratio, onHandOff, onDone }: IntroOptions) {
  const scene = use(ModelViewerSceneContext)
  const camera = useThree((state) => state.camera) as PerspectiveCamera
  const canvas = useThree((state) => state.gl.domElement)
  const invalidate = useThree((state) => state.invalidate)
  // `texture: null` once the photo failed to load.
  const [texture, setTexture] = useState<{ src: string; texture: Texture | null } | null>(null)

  useEffect(() => {
    let current: Texture | undefined
    let cancelled = false
    new TextureLoader().loadAsync(src).then(
      (loaded) => {
        loaded.colorSpace = SRGBColorSpace
        if (cancelled) {
          loaded.dispose()
          return
        }
        current = loaded
        setTexture({ src, texture: loaded })
      },
      () => {
        // Without the photo in 3D the model still appears, and the 2D photo hands over to it.
        if (!cancelled) setTexture({ src, texture: null })
      },
    )
    return () => {
      cancelled = true
      current?.dispose()
    }
  }, [src])

  const loaded = texture?.src === src ? texture : null
  const map = loaded?.texture ?? null
  const dissolve = useMemo(
    () => (map ? createDissolve(map, ratio, tokenColor(canvas, "--info")) : null),
    [map, ratio, canvas],
  )
  useEffect(() => () => dissolve?.dispose(), [dissolve])
  const rig = scene?.rig
  useEffect(() => () => rig?.setOpacity(1), [rig])

  // useFrame calls the newest render's callback, so these are the newest props.
  const handOff = () => onHandOff()
  const done = () => onDone()
  const clock = useRef({ frames: 0, start: -1, aimed: false, finished: false })

  useFrame((state) => {
    if (!scene || !rig || !loaded || clock.current.finished) return
    const { handle, framing } = scene
    const reduced = handle.get().reducedMotion
    const intro = clock.current
    if (!dissolve) {
      intro.finished = true
      handOff()
      turn(handle)
      done()
      return
    }
    const framed = rig.frame(framing, camera)
    const view = viewSizeAt(framed.distance, camera.fov, camera.aspect)
    const photo = containSize(ratio, view)
    const pixels = state.gl.domElement.height / (2 * Math.tan(((camera.fov / 2) * Math.PI) / 180))
    dissolve.place(framed.center, photo.width, photo.height, pixels)

    intro.frames += 1
    // The rig turns the camera on the frame after a call: the first frame jumps to the front, the second draws the
    // photo there, and the third hands over, once that one is on screen.
    if (intro.frames === 1) {
      rig.setOpacity(0)
      handle.api.aim("front", "jump")
    }
    if (intro.frames === 3) {
      handOff()
      intro.start = state.clock.elapsedTime
    }
    state.invalidate()
    if (intro.start < 0) return

    const duration = reduced ? crossfade : flight
    const u = (state.clock.elapsedTime - intro.start) / duration
    if (reduced) {
      dissolve.set({ opacity: 1 - smoothstep(0, 1, u), particles: false })
      rig.setOpacity(smoothstep(0, 1, u))
    } else {
      if (!intro.aimed && u > 0.08) {
        intro.aimed = true
        turn(handle)
      }
      dissolve.set({ progress: smoothstep(0.08, 0.8, u) })
      rig.setOpacity(smoothstep(0.3, 0.85, u))
    }
    if (u < 1) return
    intro.finished = true
    dissolve.hide()
    rig.setOpacity(1)
    if (reduced) turn(handle)
    invalidate()
    done()
  })

  return dissolve
}

export { useModelScanIntro }
