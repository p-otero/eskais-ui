import { readFileSync, writeFileSync } from "node:fs"

type CssVars = Record<string, string>
type CssTree = { [selector: string]: string | CssTree }
type Item = { name: string; cssVars?: { theme: CssVars; light: CssVars; dark: CssVars }; css?: CssTree }

const registryPath = "registry.json"
const read = (file: string) => readFileSync(`registry/styles/${file}`, "utf8").replaceAll(/\/\*[\s\S]*?\*\//g, "")

// Turns plain nested CSS (rules, @media, @supports) into the object shape of a registry item's `css`.
function tree(css: string): CssTree {
  let index = 0
  function parse(): CssTree {
    const node: CssTree = {}
    let buffer = ""
    while (index < css.length) {
      const char = css[index++]
      if (char === "{") {
        node[buffer.trim().replaceAll(/\s+/g, " ")] = parse()
        buffer = ""
      } else if (char === "}") {
        break
      } else if (char === ";" && !buffer.includes(":")) {
        // A statement such as `@slot` or `@custom-variant narrow (…)`: shadcn writes `{}` as `@rule;`.
        node[buffer.trim().replaceAll(/\s+/g, " ")] = {}
        buffer = ""
      } else if (char === ";") {
        const colon = buffer.indexOf(":")
        node[buffer.slice(0, colon).trim()] = buffer
          .slice(colon + 1)
          .trim()
          .replaceAll(/\s+/g, " ")
        buffer = ""
      } else {
        buffer += char
      }
    }
    return node
  }
  return parse()
}

const registry = JSON.parse(readFileSync(registryPath, "utf8")) as { items: Item[] }
const item = (name: string) => {
  const found = registry.items.find((entry) => entry.name === name)
  if (!found) throw new Error(`registry.json has no "${name}" item`)
  return found
}

const theme = tree(read("theme.css"))
// shadcn writes its one-line `@custom-variant dark (&:is(.dark *))` into any stylesheet without a custom variant, above
// what an item adds. Tailwind keeps the last definition of a variant, so the theme's block, appended later, wins.
const customVariants = Object.fromEntries(
  Object.entries(theme).filter(([selector]) => selector.startsWith("@custom-variant ")),
)
const derivedLight = ":root, [data-palette]"
const derivedDark = ".dark, .dark [data-palette], [data-palette].dark"
function vars(selector: string): CssVars {
  const node = theme[selector]
  if (!node || typeof node === "string") throw new Error(`theme.css has no "${selector}" block`)
  return Object.fromEntries(
    Object.entries(node).flatMap(([name, value]) =>
      name.startsWith("--") && typeof value === "string" ? [[name.slice(2), value]] : [],
    ),
  )
}
const prefixed = (selector: string) =>
  Object.fromEntries(Object.entries(vars(selector)).map(([name, value]) => [`--${name}`, value]))

const themeVars = vars("@theme inline")
// shadcn mirrors each cssVars.light/dark entry into `@theme inline`: `--color-x: var(--x)` for a value starting with
// hsl, rgb, # or oklch, a self-referencing `--x: var(--x)` otherwise. Only colours that have their `--color-x` stay;
// the rest go in `css` rules on the same selectors, which shadcn merges into an existing rule.
const mirrored = ([name, value]: [string, string]) =>
  /^(hsl|rgb|#|oklch)/.test(value) && Object.hasOwn(themeVars, `color-${name}`)
function split(entries: CssVars) {
  return {
    cssVars: Object.fromEntries(Object.entries(entries).filter(mirrored)),
    css: Object.fromEntries(
      Object.entries(entries)
        .filter((entry) => !mirrored(entry))
        .map(([name, value]) => [`--${name}`, value]),
    ),
  }
}
const light = split({ ...vars(":root"), ...vars(derivedLight) })
const dark = split({ ...vars(".dark"), ...vars(derivedDark) })

// shadcn writes cssVars to :root and .dark only; the palette scopes that repeat the derivation go in `css`.
item("theme").cssVars = { theme: themeVars, light: light.cssVars, dark: dark.cssVars }
item("theme").css = {
  ...customVariants,
  ":root": light.css,
  ".dark": dark.css,
  ":where(:root)": prefixed(":where(:root)"),
  "[data-palette]": prefixed(derivedLight),
  ".dark [data-palette], [data-palette].dark": prefixed(derivedDark),
  ...Object.fromEntries(
    Object.entries(theme).filter(([selector]) =>
      ["@utility ", "@supports ", "@media ", "[data-elevation"].some((prefix) => selector.startsWith(prefix)),
    ),
  ),
  "@layer components": theme["@layer components"] ?? {},
  // Apps that skip `shadcn init` have no `* { border-color }` rule, so borders fall back to currentColor.
  "@layer base": theme["@layer base"] ?? {},
}
item("palettes").css = tree(read("palettes.css"))
item("theme-compact").css = tree(read("theme-compact.css"))
item("theme-glass").css = tree(read("theme-glass.css"))

writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`)
