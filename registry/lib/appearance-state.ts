import { createColorScheme, createPreference, type ColorSchemeValue, type ValueStorage } from "@ui-sdk/core"

const defaultThemes = ["default", "compact", "glass"] as const
const defaultPalettes = ["default", "neutral", "blue", "violet", "green", "orange"] as const

type AppearanceOptions<Theme extends string, Palette extends string> = {
  /** `"system"` (default) follows the browser's `prefers-color-scheme`, live. */
  colorScheme?: ColorSchemeValue
  /** The `data-theme` on `<html>`; `"default"` leaves the attribute off. */
  theme?: NoInfer<Theme>
  themes?: readonly Theme[]
  /** The `data-palette` on `<html>` (from `@eskais/palettes`); `"default"` leaves it off, keeping your own seeds. */
  palette?: NoInfer<Palette>
  palettes?: readonly Palette[]
  /** Where each choice is kept between visits, from `createLocalStorage` and friends. */
  storage?: { colorScheme?: ValueStorage; theme?: ValueStorage; palette?: ValueStorage }
}

function setAttribute(html: HTMLElement, name: string, value: string) {
  if (value === "default") html.removeAttribute(name)
  else html.setAttribute(name, value)
}

function createAppearance<
  Theme extends string = (typeof defaultThemes)[number],
  Palette extends string = (typeof defaultPalettes)[number],
>(options: AppearanceOptions<Theme, Palette> = {}) {
  const themes = options.themes ?? (defaultThemes as unknown as readonly Theme[])
  const palettes = options.palettes ?? (defaultPalettes as unknown as readonly Palette[])
  const colorScheme = createColorScheme({
    defaultValue: options.colorScheme ?? "system",
    global: true,
    storage: options.storage?.colorScheme,
  })
  const theme = createPreference<Theme>({
    values: themes,
    defaultValue: options.theme ?? themes[0]!,
    attribute: "data-theme",
    global: true,
    storage: options.storage?.theme,
  })
  const palette = createPreference<Palette>({
    values: palettes,
    defaultValue: options.palette ?? palettes[0]!,
    attribute: "data-palette",
    global: true,
    storage: options.storage?.palette,
  })

  /** Writes the current choice to `<html>`. Call it before the first render to avoid a flash. */
  function apply() {
    if (typeof document === "undefined") return
    const html = document.documentElement
    html.classList.toggle("dark", colorScheme.get().resolved === "dark")
    setAttribute(html, "data-theme", theme.get().value)
    setAttribute(html, "data-palette", palette.get().value)
  }

  /** Applies now and on every change, the browser's scheme included, until the returned function runs. */
  function connect() {
    apply()
    const stopScheme = colorScheme.subscribe(apply)
    const stopTheme = theme.subscribe(apply)
    const stopPalette = palette.subscribe(apply)
    return () => {
      stopScheme()
      stopTheme()
      stopPalette()
    }
  }

  return { colorScheme, theme, palette, apply, connect }
}

type Appearance<Theme extends string = string, Palette extends string = string> = ReturnType<
  typeof createAppearance<Theme, Palette>
>

export { createAppearance, defaultPalettes, defaultThemes }
export type { Appearance, AppearanceOptions }
