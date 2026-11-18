import packageJson from "../../../package.json"
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
  "locale",
]

const componentItems = items.filter((item) => !guideItems.includes(item.name))

// The site deploys only from a release, so its version is a published tag. `refs/tags/` keeps a branch with the
// same name from shadowing the tag on raw.githubusercontent.com.
const releaseTag = `v${packageJson.version}`
const registryUrl = `https://raw.githubusercontent.com/p-otero/eskais-ui/refs/tags/${releaseTag}/public/r/{name}.json`

function findItem(name: string) {
  return items.find((item) => item.name === name)
}

export { componentItems, findItem, guideItems, items, registryUrl, releaseTag }
export type { RegistryFile, RegistryItem }
