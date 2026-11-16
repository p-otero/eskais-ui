import { useEffect, useState } from "react"

import { contrastRatio, type Seeds } from "../theme-snippet"

type Overrides = { brand?: string; linkBrand?: string; tint?: number; radius?: number }

// The build minifies oklch(0.5 0.2 262) to oklch(50% .2 262); write it back the way the theme does.
const plainOklch = (color: string) =>
  color
    .replace(/oklch\(\s*([\d.]+)%/, (_, lightness: string) => `oklch(${Number(lightness) / 100}`)
    .replaceAll(/(?<![\d.])\.(\d)/g, "0.$1")

function readSeeds(): Seeds {
  const style = getComputedStyle(document.documentElement)
  const read = (name: string) => style.getPropertyValue(name).trim()
  return {
    brand: plainOklch(read("--brand")),
    linkBrand: plainOklch(read("--link-brand")),
    neutralHue: Number(read("--neutral-hue")) || 0,
    neutralChroma: Number(read("--neutral-chroma")) || 0,
    radius: Number.parseFloat(read("--radius")) || 0,
  }
}

const hueOf = (color: string) => Number(/oklch\(\s*[\d.]+%?\s+[\d.]+\s+([\d.]+)/.exec(color)?.[1] ?? 0)

function applyOverrides(overrides: Overrides) {
  const root = document.documentElement.style
  const set = (name: string, value: string | undefined) =>
    value === undefined ? root.removeProperty(name) : root.setProperty(name, value)
  set("--brand", overrides.brand)
  set("--link-brand", overrides.linkBrand)
  set("--neutral-chroma", overrides.tint === undefined ? undefined : String(overrides.tint))
  set("--neutral-hue", overrides.tint === undefined ? undefined : String(hueOf(overrides.brand ?? readSeeds().brand)))
  set("--radius", overrides.radius === undefined ? undefined : `${overrides.radius}rem`)
}

function measure() {
  return {
    seeds: readSeeds(),
    primary: contrastRatio("var(--primary-foreground)", "var(--primary)"),
    text: contrastRatio("var(--foreground)", "var(--background)"),
    link: contrastRatio("var(--link)", "var(--muted)"),
  }
}

type Measured = ReturnType<typeof measure>

// A frame later, so <Appearance> has written the new class and attributes to <html> before they're read.
const remeasure = (set: (measured: Measured) => void) => requestAnimationFrame(() => set(measure()))

type Subscribable = { subscribe: (listener: () => void) => () => void }

/**
 * The theme's seeds and contrast ratios as rendered, read again whenever the color scheme or palette changes.
 * Unmounting drops the editor's overrides from <html>.
 */
function useThemeMeasurements(appearance: { colorScheme: Subscribable; palette: Subscribable }) {
  const [measured, setMeasured] = useState(measure)
  useEffect(() => {
    const frame = remeasure(setMeasured)
    const stops = [
      appearance.colorScheme.subscribe(() => remeasure(setMeasured)),
      appearance.palette.subscribe(() => remeasure(setMeasured)),
    ]
    return () => {
      cancelAnimationFrame(frame)
      for (const stop of stops) stop()
      applyOverrides({})
    }
  }, [appearance])
  return [measured, setMeasured] as const
}

export { applyOverrides, measure, useThemeMeasurements }
export type { Overrides }
