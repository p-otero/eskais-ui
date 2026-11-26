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
  meta?: { adapterOf?: string }
}

const items: RegistryItem[] = registry.items

const guideItems = [
  "utils",
  "lint-rules",
  "test-utils",
  "theme",
  "theme-compact",
  "theme-glass",
  "theme-liquid",
  "palettes",
  "font-geist",
  "font-inter",
  "icon",
  "row-navigation",
  "virtual-rows",
  "trail-rows",
  "url-param",
  "eskais-ui-skill",
  "eskais-mockup-skill",
  "eskais-mockup-cli",
  "eskais-perf-skill",
  "locale",
  "action-refusal",
  "narrow",
]

const adapterItems = items.filter((item) => item.meta?.adapterOf !== undefined)

const componentItems = items.filter((item) => !guideItems.includes(item.name) && !adapterItems.includes(item))

function adaptersOf(name: string) {
  return adapterItems.filter((item) => item.meta?.adapterOf === name)
}

// Spec: raw.githubusercontent.com serves a branch over a tag of the same name, so the site, deployed only from a
// release, pins its version through `refs/tags/`.
const releaseTag = `v${packageJson.version}`
const registryUrl = `https://raw.githubusercontent.com/p-otero/eskais-ui/refs/tags/${releaseTag}/public/r/{name}.json`

const uiSdkVersion =
  items
    .flatMap((item) => item.dependencies ?? [])
    .find((dependency) => dependency.startsWith("@ui-sdk/react@"))
    ?.slice("@ui-sdk/react@".length) ?? "latest"

// Spec: Vercel's skills CLI installs the agent skills. Pinned to a release at least 7 days old, so pnpm dlx runs it under
// pnpm's default minimumReleaseAge, like the registry's own pins.
const skillsCliVersion = "1.8.1"

function findItem(name: string) {
  return items.find((item) => item.name === name)
}

export {
  adapterItems,
  adaptersOf,
  componentItems,
  findItem,
  guideItems,
  items,
  registryUrl,
  releaseTag,
  skillsCliVersion,
  uiSdkVersion,
}
export type { RegistryFile, RegistryItem }
