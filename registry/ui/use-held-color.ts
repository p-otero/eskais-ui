"use client"

import { colorDistance, formatColor, isInGamut, toGamut, type Color, type ColorGamut } from "@ui-sdk/core/color"
import type { ColorChannel, ColorPickerController, ColorPickerSpace } from "@ui-sdk/react/color-picker"
import { useCallback, useLayoutEffect, useRef } from "react"

import { keysOf } from "@/lib/narrow"

/** A key pressed on a thumb: the area's, across `x` and up `y`, or a slider's for `channel`. */
type KeyStep = { key: string; shift: boolean; rtl: boolean } & (
  | { x: ColorChannel; y: ColorChannel }
  | { channel: ColorChannel }
)
/**
 * How an interaction ends: a key, or a pointer lifting where it puts each channel it drags, from 0 to 1 of its range.
 * UI SDK moves at most once a frame, and a pointer that lifts sooner commits a move no render has shown.
 */
type Ending = KeyStep | { release: Partial<Record<ColorChannel, number>> }

type Spec = { index: number; max: number; step: number; scale: number }

const oklchChannels: Partial<Record<ColorChannel, Spec>> = {
  lightness: { index: 0, max: 100, step: 0.1, scale: 100 },
  chroma: { index: 1, max: 0.4, step: 0.001, scale: 1 },
  hue: { index: 2, max: 360, step: 1, scale: 1 },
  alpha: { index: 3, max: 100, step: 1, scale: 100 },
}

const decimals = (step: number) => (Number.isInteger(step) ? 0 : (String(step).split(".")[1] ?? "").length)

function snap(value: number, spec: Spec) {
  const steps = Math.round(Number((value / spec.step).toPrecision(15)))
  return Math.min(spec.max, Math.max(0, Number((steps * spec.step).toFixed(decimals(spec.step)))))
}

function read(color: Color, spec: Spec) {
  const coord = spec.index === 3 ? color.alpha : color.coords[spec.index]
  return Number(((coord ?? 0) * spec.scale).toFixed(4))
}

function write(color: Color, spec: Spec, value: number): Color {
  const coord = Math.min(spec.max, Math.max(0, value)) / spec.scale
  if (spec.index === 3) return { ...color, alpha: coord }
  const coords: Color["coords"] = [...color.coords]
  coords[spec.index] = coord
  return { ...color, coords }
}

function placed(color: Color, fractions: Partial<Record<ColorChannel, number>>): Color | null {
  let next = color
  for (const channel of keysOf(fractions)) {
    const fraction = fractions[channel]
    const spec = oklchChannels[channel]
    if (!spec || fraction === undefined) return null
    next = write(next, spec, snap(Math.min(1, Math.max(0, fraction)) * spec.max, spec))
  }
  return next
}

function stepped(color: Color, step: KeyStep): Color | null {
  const times = step.shift ? 10 : 1
  const across = step.rtl ? -1 : 1
  if ("channel" in step) {
    const spec = oklchChannels[step.channel]
    if (!spec) return null
    const current = read(color, spec)
    const moves: Record<string, number> = {
      ArrowUp: current + spec.step * times,
      ArrowDown: current - spec.step * times,
      ArrowRight: current + across * spec.step * times,
      ArrowLeft: current - across * spec.step * times,
      PageUp: current + spec.max / 10,
      PageDown: current - spec.max / 10,
      Home: 0,
      End: spec.max,
    }
    const move = moves[step.key]
    return move === undefined ? null : write(color, spec, snap(move, spec))
  }
  const x = oklchChannels[step.x]
  const y = oklchChannels[step.y]
  if (!x || !y) return null
  let [nextX, nextY] = [read(color, x), read(color, y)]
  if (step.key === "ArrowRight" || step.key === "ArrowLeft")
    nextX += (step.key === "ArrowRight" ? across : -across) * x.step * times
  else if (step.key === "ArrowUp" || step.key === "ArrowDown")
    nextY += (step.key === "ArrowUp" ? 1 : -1) * y.step * times
  else if (step.key === "PageUp" || step.key === "PageDown") nextY += ((step.key === "PageUp" ? 1 : -1) * y.max) / 10
  else if (step.key === "Home") nextX = 0
  else if (step.key === "End") nextX = x.max
  else return null
  return write(write(color, x, snap(nextX, x)), y, snap(nextY, y))
}

type HeldColorOptions = {
  color: Color
  space: ColorPickerSpace | undefined
  gamut: ColorGamut | false | undefined
  controller: ColorPickerController
}

/**
 * Keeps the thumbs where a drag or a key left them past the gamut's edge. Ending an interaction, UI SDK moves its
 * colour to the closest one inside, and the thumb jumps back, though the value is that closest colour already.
 * When the colour held before (after a key's step) maps to UI SDK's, this puts it back. Returns where a thumb
 * reports a key, since UI SDK steps and commits a key in one event, with no render between.
 */
function useHeldColor({ color, space, gamut = "srgb", controller }: HeldColorOptions) {
  const held = useRef<Color | null>(null)
  const ending = useRef<Ending | null>(null)
  useLayoutEffect(() => {
    const previous = held.current
    const end = ending.current
    held.current = color
    ending.current = null
    if (!previous || !end || space !== "oklch" || !gamut || !isInGamut(color, gamut)) return
    const candidates = "release" in end ? [previous, placed(previous, end.release)] : [stepped(previous, end)]
    const candidate = candidates.find(
      (option) =>
        option &&
        !isInGamut(option, gamut) &&
        option.alpha === color.alpha &&
        colorDistance(toGamut(option, gamut), color) <= 1e-6,
    )
    if (!candidate) return
    // Workaround: UI SDK reads a hue of 360 as 0, which would send a hue thumb from one end to the other.
    const [l, c, h] = candidate.coords
    const kept = { ...candidate, coords: [l, c, h !== null && h >= 360 ? 360 - 1e-9 : h] satisfies Color["coords"] }
    // Spec: 17 significant digits write a double exactly, so UI SDK reads back the same colour.
    controller.setValue(formatColor(kept, "oklch", { precision: 17 }))
  }, [color, space, gamut, controller])
  return useCallback((next: Ending) => {
    ending.current = next
    setTimeout(() => {
      if (ending.current === next) ending.current = null
    })
  }, [])
}

export { useHeldColor }
export type { Ending, KeyStep }
