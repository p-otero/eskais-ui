import { createColorScheme, createPreference, type ColorSchemeValue, type ValueStorage } from "@ui-sdk/core"

const defaultThemes = ["default", "compact", "glass"] as const

type AppearanceOptions<Theme extends string> = {
  /** `"system"` (default) follows the browser's `prefers-color-scheme`, live. */
  colorScheme?: ColorSchemeValue
  /** The `data-theme` on `<html>`; `"default"` leaves the attribute off. */
  theme?: NoInfer<Theme>
  themes?: readonly Theme[]
  /** Where each choice is kept between visits, from `createLocalStorage` and friends. */
  storage?: { colorScheme?: ValueStorage; theme?: ValueStorage }
}

function createAppearance<Theme extends string = (typeof defaultThemes)[number]>(
  options: AppearanceOptions<Theme> = {},
) {
  const themes = options.themes ?? (defaultThemes as unknown as readonly Theme[])
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

  /** Writes the current choice to `<html>`. Call it before the first render to avoid a flash. */
  function apply() {
    if (typeof document === "undefined") return
    const html = document.documentElement
    html.classList.toggle("dark", colorScheme.get().resolved === "dark")
    const value = theme.get().value
    if (value === "default") html.removeAttribute("data-theme")
    else html.setAttribute("data-theme", value)
  }

  /** Applies now and on every change, the browser's scheme included, until the returned function runs. */
  function connect() {
    apply()
    const stopScheme = colorScheme.subscribe(apply)
    const stopTheme = theme.subscribe(apply)
    return () => {
      stopScheme()
      stopTheme()
    }
  }

  return { colorScheme, theme, apply, connect }
}

type Appearance<Theme extends string = string> = ReturnType<typeof createAppearance<Theme>>

export { createAppearance, defaultThemes }
export type { Appearance, AppearanceOptions }
