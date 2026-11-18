"use client"

import { useEffect, type RefObject } from "react"

import { paintArea, type AreaGamut } from "@/lib/oklch-gamut"

// Half the CSS size, scaled up by the browser: the area is a smooth field, and every hue step repaints it, so more
// pixels would cost time on each step for no visible gain.
function paint(canvas: HTMLCanvasElement, hue: number, gamut: AreaGamut) {
  const width = Math.ceil(canvas.clientWidth / 2)
  const height = Math.ceil(canvas.clientHeight / 2)
  if (width < 2 || height < 2) return
  const wide = gamut === "p3" && matchMedia("(color-gamut: p3)").matches
  const context = canvas.getContext("2d", wide ? { colorSpace: "display-p3" } : undefined)
  if (!context) return
  if (canvas.width !== width) canvas.width = width
  if (canvas.height !== height) canvas.height = height
  const pixels = paintArea(width, height, hue, wide ? "p3" : "srgb")
  context.putImageData(new ImageData(pixels, width, height, wide ? { colorSpace: "display-p3" } : undefined), 0, 0)
}

/** Paints an OKLCH area at `hue` into `canvas` (when it's set), again whenever the hue or the canvas's size changes. */
function useColorAreaCanvas(canvas: RefObject<HTMLCanvasElement | null> | null, hue: number, gamut: AreaGamut) {
  useEffect(() => {
    const element = canvas?.current
    if (!element) return
    let frame = 0
    paint(element, hue, gamut)
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => paint(element, hue, gamut))
    })
    observer.observe(element)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [canvas, hue, gamut])
}

export { useColorAreaCanvas }
