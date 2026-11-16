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
      } else if (char === ";") {
        const colon = buffer.indexOf(":")
        node[buffer.slice(0, colon).trim()] = buffer.slice(colon + 1).trim()
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

// shadcn writes cssVars to :root and .dark only; the palette scopes that repeat the derivation go in `css`.
item("theme").cssVars = {
  theme: vars("@theme inline"),
  light: { ...vars(":root"), ...vars(derivedLight) },
  dark: { ...vars(".dark"), ...vars(derivedDark) },
}
const { "@layer base": base } = item("theme").css ?? {}
item("theme").css = {
  ":where(:root)": prefixed(":where(:root)"),
  "[data-palette]": prefixed(derivedLight),
  ".dark [data-palette], [data-palette].dark": prefixed(derivedDark),
  ...Object.fromEntries(
    Object.entries(theme).filter(([selector]) => selector.startsWith("@utility ") || selector.startsWith("@supports ")),
  ),
  ...(base ? { "@layer base": base } : {}),
}
item("palettes").css = tree(read("palettes.css"))
item("theme-compact").css = tree(read("theme-compact.css"))
item("theme-glass").css = tree(read("theme-glass.css"))

writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`)
