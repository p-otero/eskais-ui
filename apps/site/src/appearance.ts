import { createLocalStorage } from "@ui-sdk/core"

import { createAppearance } from "@/components/ui/appearance"

import { createThemeEditorStore } from "../../showcase/src/theme-editor-store"

const themes = ["default", "compact", "glass"] as const
const palettes = ["neutral", "blue", "violet", "green", "orange"] as const
type Theme = (typeof themes)[number]
type Palette = (typeof palettes)[number]

const appearance = createAppearance<Theme, Palette>({
  colorScheme: "system",
  themes,
  palette: "neutral",
  palettes,
  storage: {
    colorScheme: createLocalStorage("eskais-site-scheme"),
    theme: createLocalStorage("eskais-site-theme"),
    palette: createLocalStorage("eskais-site-palette"),
    density: createLocalStorage("eskais-site-density"),
    radius: createLocalStorage("eskais-site-radius"),
  },
})

const themeEditor = createThemeEditorStore({ storageKey: "eskais-site-theme-editor" })

export { appearance, palettes, themeEditor, themes }
export type { Palette, Theme }
