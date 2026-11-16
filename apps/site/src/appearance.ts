import { createLocalStorage } from "@ui-sdk/core"

import { createAppearance } from "@/components/ui/appearance"

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
  },
})

export { appearance, palettes, themes }
export type { Palette, Theme }
