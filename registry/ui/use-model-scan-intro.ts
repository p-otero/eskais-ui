import { useFrame, useThree } from "@react-three/fiber"
import { use, useEffect, useMemo, useRef, useState } from "react"
import {
  Color,
  Group,
  Plane,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  type Material,
  type Mesh,
  type Object3D,
  type PerspectiveCamera,
  type Texture,
} from "three"

import { cloudGrid, createCloud, shimmerHeight, type Cloud } from "@/components/ui/model-scan-cloud"
import { personCells, type ModelScanMask, type ModelScanPersonSource } from "@/components/ui/model-scan-mask"
import { fitSize, viewSizeAt } from "@/components/ui/model-viewer-math"
import type { ModelViewerHandle } from "@/components/ui/model-viewer-primitive"
import { ModelViewerSceneContext, type ModelRig } from "@/components/ui/model-viewer-rig"
import { isDark, onThemeChange, tokenColor } from "@/components/ui/model-viewer-theme"

// Seconds: the cloud flies while the camera turns, or the photo crossfades under reduced motion.
const flight = 3.4
const crossfade = 0.7

const smoothstep = (from: number, to: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)))
  return t * t * (3 - 2 * t)
}

// The chosen view becomes the three-quarter one, and the camera turns there even if it was chosen already.
function turn(handle: ModelViewerHandle) {
  handle.api.setView("three-quarter")
  handle.api.aim("three-quarter")
}

// A clipping plane compiles the model's materials again: done on the first frame, under the 2D photo, and once the
// cloud has landed.
function setClipping(root: Object3D, planes: Plane[] | null) {
  root.traverse((object) => {
    if (!(object as Mesh).isMesh) return
    for (const material of [(object as Mesh).material].flat() as Material[]) {
      material.clippingPlanes = planes
      material.needsUpdate = true
    }
  })
}

/** A clipping plane that keeps what is above a height and cuts the rest. */
function createReveal() {
  const plane = new Plane(new Vector3(0, 1, 0), 0)
  return {
    plane,
    above(y: number) {
      plane.constant = -y
    },
  }
}

type IntroOptions = {
  src: string
  /** The photo's width over its height. */
  ratio: number
  /** How the photo fills a stage of another ratio, as the 2D one is drawn. */
  fit: "contain" | "cover"
  /** The person in the photo, whose pixels fly onto the model; without one, every pixel does. */
  mask: ModelScanMask | null
  /** Where the mask came from, written on the canvas for tooling. */
  person: ModelScanPersonSource
  /** The 3D photo matches the 2D one: the 2D layer can go. */
  onHandOff: () => void
  /** The model has taken the photo's place. */
  onDone: () => void
}

/**
 * The photo on a plane where the front camera sees it exactly as the 2D photo was drawn, then, once the model has
 * loaded, the camera turns to the three-quarter view while the person's pixels fly onto the model's surface, a
 * shimmer runs down it revealing the model, and a pulse runs across the floor. Under reduced motion the photo
 * crossfades into the model and the camera jumps after.
 */
function useModelScanIntro({ src, ratio, fit, mask, person, onHandOff, onDone }: IntroOptions) {
  const scene = use(ModelViewerSceneContext)
  const camera = useThree((state) => state.camera) as PerspectiveCamera
  const gl = useThree((state) => state.gl)
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

  const group = useMemo(() => new Group(), [])
  // Built on the transition's first frame, from the model as it stands then.
  const cloud = useRef<Cloud | null>(null)
  useEffect(
    () => () => {
      if (!cloud.current) return
      group.remove(...cloud.current.objects)
      cloud.current.dispose()
      cloud.current = null
    },
    [group],
  )
  const colors = useMemo(() => ({ accent: new Color(), background: new Color() }), [])
  useEffect(() => {
    const read = () => {
      tokenColor(gl.domElement, "--info", 0x3b82f6, colors.accent)
      tokenColor(gl.domElement, "--background", 0xffffff, colors.background)
      cloud.current?.theme(colors.accent, isDark(colors.background))
      invalidate()
    }
    read()
    return onThemeChange(read)
  }, [gl, colors, invalidate])

  // The model is revealed from the head down, just behind the cloud's shimmer.
  const reveal = useMemo(() => createReveal(), [])
  const clipped = useRef<ModelRig | null>(null)
  const rig = scene?.rig
  const floor = scene?.floor
  useEffect(
    () => () => {
      rig?.setOpacity(1)
      floor?.set({ opacity: 1, pulse: 0 })
      if (clipped.current) setClipping(clipped.current.scene, null)
      clipped.current = null
    },
    [rig, floor],
  )
  // The canvas draws on demand, and the intro moves only inside a frame: once the photo's texture and the model are
  // both here, ask for one. Without it, a texture that loads after the scene has gone still never starts the intro.
  const loaded = texture?.src === src && rig !== undefined && rig !== null
  useEffect(() => {
    if (loaded) invalidate()
  }, [loaded, invalidate])

  // useFrame calls the newest render's callback, so these are the newest props.
  const handOff = () => onHandOff()
  const done = () => onDone()
  const clock = useRef({ frames: 0, start: -1, aimed: false, finished: false })
  const center = useMemo(() => new Vector3(), [])

  useFrame((state) => {
    if (!scene || !rig || !texture || texture.src !== src || clock.current.finished) return
    const { handle, framing } = scene
    const reduced = handle.get().reducedMotion
    const intro = clock.current
    const map = texture.texture
    if (!map) {
      intro.finished = true
      handOff()
      turn(handle)
      done()
      return
    }
    const bounds = rig.bounds
    const feet = bounds.center.y - bounds.size.y / 2
    const framed = rig.frame(framing, camera)
    center.copy(framed.center)
    const view = viewSizeAt(framed.distance, camera.fov, camera.aspect)
    const photo = fitSize(ratio, view, fit)
    const pixels = state.gl.domElement.height / (2 * Math.tan(((camera.fov / 2) * Math.PI) / 180))

    intro.frames += 1
    // The rig turns the camera on the frame after a call: the first frame jumps to the front and builds the cloud
    // while the 2D photo still covers the stage, the second draws the photo there, and the third hands over.
    if (intro.frames === 1) {
      state.gl.localClippingEnabled = true
      handle.api.aim("front", "jump")
      floor?.set({ opacity: 0, pulse: 0 })
      const built = performance.now()
      const grid = cloudGrid(ratio)
      cloud.current = createCloud({
        texture: map,
        ratio,
        accent: colors.accent,
        model: rig.scene,
        person: reduced ? null : personCells(grid.columns, grid.rows, mask),
        bounds,
        dark: isDark(colors.background),
      })
      group.add(...cloud.current.objects)
      if (reduced) rig.setOpacity(0)
      else rig.setOpacity(1)
      const canvas = state.gl.domElement.dataset
      canvas.particles = String(cloud.current.particles)
      canvas.person = person
      canvas.cloudMs = (performance.now() - built).toFixed(1)
    }
    // A model that replaces the base one mid-flight (the final character) is revealed the same way.
    if (!reduced && clipped.current !== rig) {
      if (clipped.current) setClipping(clipped.current.scene, null)
      setClipping(rig.scene, [reveal.plane])
      clipped.current = rig
      if (intro.start < 0) reveal.above(feet + bounds.size.y * 1.1)
    }
    if (intro.frames === 3) {
      handOff()
      intro.start = state.clock.elapsedTime
    }
    cloud.current?.place(center, photo.width, photo.height, pixels, camera.position.distanceTo(center))
    state.invalidate()
    if (intro.start < 0) return

    const u = (state.clock.elapsedTime - intro.start) / (reduced ? crossfade : flight)
    if (reduced) {
      cloud.current?.fade(1 - smoothstep(0, 1, u))
      rig.setOpacity(smoothstep(0, 1, u))
      floor?.set({ opacity: smoothstep(0, 1, u) })
    } else {
      if (!intro.aimed && u > 0.08) {
        intro.aimed = true
        turn(handle)
      }
      cloud.current?.set(u)
      reveal.above(feet + bounds.size.y * (shimmerHeight(u) - 0.03))
      floor?.set({ opacity: smoothstep(0.05, 0.5, u), pulse: u > 0.72 ? smoothstep(0.72, 1, u) : 0 })
    }
    if (u < 1) return
    intro.finished = true
    cloud.current?.hide()
    floor?.set({ opacity: 1, pulse: 0 })
    if (clipped.current) setClipping(clipped.current.scene, null)
    clipped.current = null
    rig.setOpacity(1)
    if (reduced) turn(handle)
    invalidate()
    done()
  })

  return group
}

export { useModelScanIntro }
