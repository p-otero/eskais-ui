import { readFileSync, writeFileSync } from "node:fs"

type CssVars = Record<string, string>
type CssTree = { [selector: string]: string | CssTree }
type Item = { name: string; cssVars?: { theme: CssVars; light: CssVars; dark: CssVars }; css?: CssTree }

const registryPath = "registry.json"
const read = (file: string) => readFileSync(`registry/styles/${file}`, "utf8").replaceAll(/\/\*[\s\S]*?\*\//g, "")

function block(css: string, selector: string): CssVars {
  const start = css.indexOf(`${selector} {`)
  if (start === -1) throw new Error(`theme.css has no "${selector}" block`)
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start))
  const vars: CssVars = {}
  for (const match of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    const [, name, value] = match
    if (name && value) vars[name] = value.trim()
  }
  return vars
}

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

const themeCss = read("theme.css")
item("theme").cssVars = {
  theme: block(themeCss, "@theme inline"),
  light: block(themeCss, ":root"),
  dark: block(themeCss, ".dark"),
}
const shapeStart = themeCss.indexOf(":where(:root) {")
const shape = tree(themeCss.slice(shapeStart, themeCss.indexOf("}", shapeStart) + 1))
const { "@layer base": base } = item("theme").css ?? {}
item("theme").css = {
  ...shape,
  ...Object.fromEntries(Object.entries(tree(themeCss)).filter(([selector]) => selector.startsWith("@utility "))),
  ...(base ? { "@layer base": base } : {}),
}
item("theme-compact").css = tree(read("theme-compact.css"))
item("theme-glass").css = tree(read("theme-glass.css"))

writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`)
