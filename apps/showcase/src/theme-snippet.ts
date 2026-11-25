type Seeds = { brand: string; linkBrand: string; neutralHue: number; neutralChroma: number; radius: number }

type Attributes = { density: string; radius: string; glass?: number | undefined }

/** The glass tokens for a strength from 0 to 100: 0 is opaque and sharp, 100 clear behind a 50px blur. */
function glassTokens(strength: number) {
  return { opacity: `${String(100 - strength)}%`, blur: `${String(strength / 2)}px` }
}

function themeSnippet(seeds: Seeds, attributes: Attributes = { density: "default", radius: "default" }) {
  const steps = [
    attributes.glass === undefined ? "" : 'data-theme="glass"',
    attributes.density === "default" ? "" : `data-density="${attributes.density}"`,
    attributes.radius === "default" ? "" : `data-radius="${attributes.radius}"`,
  ].filter(Boolean)
  const lines = [
    ...(steps.length > 0 ? [`/* On <html>: ${steps.join(" ")} */`, ""] : []),
    ":root {",
    `  --brand: ${seeds.brand};`,
    `  --link-brand: ${seeds.linkBrand};`,
    `  --neutral-hue: ${String(seeds.neutralHue)};`,
    `  --neutral-chroma: ${String(seeds.neutralChroma)};`,
    ...(attributes.radius === "default" ? [`  --radius: ${String(seeds.radius)}rem;`] : []),
    "}",
  ]
  if (attributes.glass !== undefined) {
    const { opacity, blur } = glassTokens(attributes.glass)
    lines.push("", '[data-theme="glass"] {', `  --glass-opacity: ${opacity};`, `  --glass-blur: ${blur};`, "}")
  }
  lines.push("", "/* .dark derives from the same seeds.", "   To change one token, override it:", ".dark {")
  lines.push("  --primary: oklch(0.8 0.1 262);", "} */", "")
  return lines.join("\n")
}

function toRgb(color: string, probe: HTMLElement, context: CanvasRenderingContext2D) {
  probe.style.color = color
  context.clearRect(0, 0, 1, 1)
  context.fillStyle = getComputedStyle(probe).color
  context.fillRect(0, 0, 1, 1)
  return Array.from(context.getImageData(0, 0, 1, 1).data.slice(0, 3))
}

function luminance(rgb: number[]) {
  const [r = 0, g = 0, b = 0] = rgb.map((value) => {
    const channel = value / 255
    return channel <= 0.040_45 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrastRatio(foreground: string, background: string) {
  const context = document.createElement("canvas").getContext("2d", { willReadFrequently: true })
  if (!context) return null
  const probe = document.createElement("span")
  document.body.append(probe)
  const [a, b] = [luminance(toRgb(foreground, probe, context)), luminance(toRgb(background, probe, context))]
  probe.remove()
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

export { contrastRatio, glassTokens, themeSnippet }
export type { Seeds }
