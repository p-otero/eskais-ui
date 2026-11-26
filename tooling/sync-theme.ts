import { readFileSync, writeFileSync } from "node:fs"

type CssVars = Record<string, string>
type CssTree = { [selector: string]: string | CssTree }
type Item = { name: string; cssVars?: { theme: CssVars; light: CssVars; dark: CssVars }; css?: CssTree }

const registryPath = "registry.json"
const read = (file: string) => readFileSync(`registry/styles/${file}`, "utf8").replaceAll(/\/\*[\s\S]*?\*\//g, "")

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
        // Spec: shadcn writes `{}` as `@rule;`, a statement such as `@slot` or `@custom-variant narrow (…)`.
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

function topLevelSelectors(selector: string) {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let index = 0; index < selector.length; index++) {
    const char = selector[index]
    if (char === "(" || char === "[") depth++
    else if (char === ")" || char === "]") depth--
    else if (char === "," && depth === 0) {
      parts.push(selector.slice(start, index).trim())
      start = index + 1
    }
  }
  return [...parts, selector.slice(start).trim()]
}

function oneSelectorPerRule(node: CssTree): CssTree {
  const result: CssTree = {}
  for (const [key, value] of Object.entries(node)) {
    if (typeof value === "string") {
      result[key] = value
      continue
    }
    const body = oneSelectorPerRule(value)
    const selectors = key.startsWith("@") ? [key] : topLevelSelectors(key)
    for (const selector of selectors) {
      const existing = result[selector]
      result[selector] = typeof existing === "object" ? { ...existing, ...body } : body
    }
  }
  return result
}

const registry = JSON.parse(readFileSync(registryPath, "utf8")) as { items: Item[] }
const item = (name: string) => {
  const found = registry.items.find((entry) => entry.name === name)
  if (!found) throw new Error(`registry.json has no "${name}" item`)
  return found
}

const theme = tree(read("theme.css"))
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

item("theme").cssVars = { theme: themeVars, light: light.cssVars, dark: dark.cssVars }
item("theme").css = oneSelectorPerRule({
  ...customVariants,
  ":root": light.css,
  ".dark": dark.css,
  ":where(:root)": prefixed(":where(:root)"),
  "[data-palette]": prefixed(derivedLight),
  ".dark [data-palette], [data-palette].dark": prefixed(derivedDark),
  ...Object.fromEntries(
    Object.entries(theme).filter(([selector]) =>
      ["@utility ", "@supports ", "@media ", "[data-elevation", "[data-radius"].some((prefix) =>
        selector.startsWith(prefix),
      ),
    ),
  ),
  "@layer components": theme["@layer components"] ?? {},
  "@layer base": theme["@layer base"] ?? {},
})
item("palettes").css = oneSelectorPerRule(tree(read("palettes.css")))
item("theme-compact").css = oneSelectorPerRule(tree(read("theme-compact.css")))
item("theme-glass").css = oneSelectorPerRule(tree(read("theme-glass.css")))
item("theme-liquid").css = oneSelectorPerRule(tree(read("theme-liquid.css")))
item("prism-picker").css = oneSelectorPerRule(tree(read("prism-picker.css")))
for (const instrument of ["sun-arc", "mixer", "safe-dial", "vinyl-scrubber"]) {
  item(instrument).css = oneSelectorPerRule(tree(read(`${instrument}.css`)))
}
item("live-sky").css = oneSelectorPerRule(tree(read("live-sky.css")))
for (const name of ["led-matrix", "neon-sign", "chalkboard", "teletext"])
  item(name).css = oneSelectorPerRule(tree(read(`${name}.css`)))
item("retro-tv").css = oneSelectorPerRule(tree(read("retro-tv.css")))
item("pill-dialog").css = oneSelectorPerRule(tree(read("pill-dialog.css")))

writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`)
