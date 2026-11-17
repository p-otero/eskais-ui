import registry from "../../../registry.json"

type RegistryFile = { path: string; type: string; target?: string }

type RegistryItem = {
  name: string
  type: string
  title?: string
  description?: string
  docs?: string
  dependencies?: string[]
  registryDependencies?: string[]
  files?: RegistryFile[]
}

const items: RegistryItem[] = registry.items

// Covered by the guides instead of a page of their own.
const guideItems = [
  "utils",
  "lint-rules",
  "test-utils",
  "theme",
  "theme-compact",
  "theme-glass",
  "palettes",
  "font-geist",
  "font-inter",
  "icon",
  "row-navigation",
  "virtual-rows",
  "eskais-ui-skill",
  "eskais-mockup-skill",
  "eskais-perf-skill",
]

const componentItems = items.filter((item) => !guideItems.includes(item.name))

const registryUrl = "https://raw.githubusercontent.com/p-otero/eskais-ui/main/public/r/{name}.json"

function findItem(name: string) {
  return items.find((item) => item.name === name)
}

export { componentItems, findItem, guideItems, items, registryUrl }
export type { RegistryFile, RegistryItem }
