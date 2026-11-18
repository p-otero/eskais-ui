type Seeds = { brand: string; linkBrand: string; neutralHue: number; neutralChroma: number; radius: number }

type Attributes = { density: string; radius: string }

// A chosen density or radius step is an attribute, not a seed; with no step, --radius is the seed of the shape.
function themeSnippet(seeds: Seeds, attributes: Attributes = { density: "default", radius: "default" }) {
  const steps = [
    attributes.density === "default" ? "" : `data-density="${attributes.density}"`,
    attributes.radius === "default" ? "" : `data-radius="${attributes.radius}"`,
  ].filter(Boolean)
  const html =
    steps.length > 0
      ? `/* On <html>: ${steps.join(" ")} */

`
      : ""
  const radius =
    attributes.radius === "default"
      ? `
  --radius: ${seeds.radius}rem;`
      : ""
  return `${html}:root {
  --brand: ${seeds.brand};
  --link-brand: ${seeds.linkBrand};
  --neutral-hue: ${seeds.neutralHue};
  --neutral-chroma: ${seeds.neutralChroma};${radius}
}

/* .dark derives from the same seeds.
   To change one token, override it:
.dark {
  --primary: oklch(0.8 0.1 262);
} */
`
}

// Resolves each CSS color through a canvas pixel, which turns any syntax (relative colors included) into sRGB.
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

export { contrastRatio, themeSnippet }
export type { Seeds }
