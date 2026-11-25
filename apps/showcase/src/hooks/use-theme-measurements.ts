import { useEffect, useState } from "react"

import { contrastRatio, type Seeds } from "../theme-snippet"

// Workaround: the build minifies oklch(0.5 0.2 262) to oklch(50% .2 262); write it back the way the theme does.
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

function measure() {
  return {
    seeds: readSeeds(),
    primary: contrastRatio("var(--primary-foreground)", "var(--primary)"),
    text: contrastRatio("var(--foreground)", "var(--background)"),
    link: contrastRatio("var(--link)", "var(--muted)"),
  }
}

type Measured = ReturnType<typeof measure>

const remeasureAfterAppearanceWrites = (set: (measured: Measured) => void) =>
  requestAnimationFrame(() => set(measure()))

type Subscribable = { subscribe: (listener: () => void) => () => void }

type Sources = {
  colorScheme: Subscribable
  theme: Subscribable
  palette: Subscribable
  density: Subscribable
  radius: Subscribable
}

function useThemeMeasurements(appearance: Sources, store: Subscribable) {
  const [measured, setMeasured] = useState(measure)
  useEffect(() => {
    const frame = remeasureAfterAppearanceWrites(setMeasured)
    const { colorScheme, theme, palette, density, radius } = appearance
    const stops = [colorScheme, theme, palette, density, radius, store].map((source) =>
      source.subscribe(() => remeasureAfterAppearanceWrites(setMeasured)),
    )
    return () => {
      cancelAnimationFrame(frame)
      for (const stop of stops) stop()
    }
  }, [appearance, store])
  return [measured, setMeasured] as const
}

export { measure, readSeeds, useThemeMeasurements }
