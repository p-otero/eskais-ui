import { readSeeds } from "./hooks/use-theme-measurements"

type Overrides = { brand?: string; linkBrand?: string; tint?: number }

const colourKeys = ["brand", "linkBrand"] as const
const numberKeys = ["tint"] as const

// Saved state comes from an earlier version or another tab, so keep only the fields that still make sense.
function sanitize(value: unknown): Overrides {
  if (typeof value !== "object" || value === null) return {}
  const record = value as Record<string, unknown>
  const overrides: Overrides = {}
  for (const key of colourKeys) {
    const colour = record[key]
    if (typeof colour === "string" && colour.length < 80 && CSS.supports("color", colour)) overrides[key] = colour
  }
  for (const key of numberKeys) {
    const number = record[key]
    if (typeof number === "number" && Number.isFinite(number)) overrides[key] = number
  }
  return overrides
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
}

function readStorage(key: string | undefined): Overrides {
  if (!key) return {}
  try {
    const raw = localStorage.getItem(key)
    return raw ? sanitize(JSON.parse(raw)) : {}
  } catch {
    return {}
  }
}

function writeStorage(key: string | undefined, overrides: Overrides) {
  if (!key) return
  try {
    if (Object.keys(overrides).length === 0) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(overrides))
  } catch {
    // Storage can be full, blocked or missing (a private window); the choice still holds for this page.
  }
}

/**
 * The theme editor's choices, kept outside React so they outlive the editor: leaving the page keeps them on
 * `<html>`, and with a `storageKey` they come back on the next visit. Call `apply()` before the first render.
 */
function createThemeEditorStore({ storageKey }: { storageKey?: string } = {}) {
  let overrides = readStorage(storageKey)
  const listeners = new Set<() => void>()

  const apply = () => {
    if (typeof document !== "undefined") applyOverrides(overrides)
  }
  const set = (next: Overrides) => {
    overrides = next
    apply()
    writeStorage(storageKey, overrides)
    for (const listener of listeners) listener()
  }

  return {
    get: () => overrides,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    set,
    reset: () => set({}),
    apply,
  }
}

type ThemeEditorStore = ReturnType<typeof createThemeEditorStore>

export { applyOverrides, createThemeEditorStore, sanitize }
export type { Overrides, ThemeEditorStore }
