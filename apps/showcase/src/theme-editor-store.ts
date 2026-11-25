import { readSeeds } from "./hooks/use-theme-measurements"
import { glassTokens } from "./theme-snippet"

/** `glass` is the glass strength, 0 to 100. */
type Overrides = { brand?: string; linkBrand?: string; tint?: number; glass?: number }

const colourKeys = ["brand", "linkBrand"] as const
const numberKeys = ["tint", "glass"] as const

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
  if (overrides.glass !== undefined) overrides.glass = Math.min(100, Math.max(0, overrides.glass))
  return overrides
}

const themeGlassItemStrength = 40

const glassStyleId = "theme-editor-glass"

function applyGlass(strength: number | undefined) {
  const existing = document.getElementById(glassStyleId)
  if (strength === undefined) {
    existing?.remove()
    return
  }
  const style = existing ?? Object.assign(document.createElement("style"), { id: glassStyleId })
  const { opacity, blur } = glassTokens(strength)
  style.textContent = `[data-theme="glass"] { --glass-opacity: ${opacity}; --glass-blur: ${blur}; }`
  if (!existing) document.head.append(style)
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
  applyGlass(overrides.glass)
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
    // Spec: Web Storage throws when full, blocked or missing (a private window); the choice still holds for this page.
  }
}

/**
 * Kept outside React, so the choices outlive the editor; with a `storageKey` they come back on the next visit. Call
 * `apply()` before the first render.
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

export { applyOverrides, createThemeEditorStore, themeGlassItemStrength, sanitize }
export type { Overrides, ThemeEditorStore }
