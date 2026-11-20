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
  "trail-rows",
  "url-param",
  "eskais-ui-skill",
  "eskais-mockup-skill",
  "eskais-mockup-cli",
  "eskais-perf-skill",
  "locale",
  "action-refusal",
]

const componentItems = items.filter((item) => !guideItems.includes(item.name))

// The site deploys only from a release, so its version is a published tag. `refs/tags/` keeps a branch with the
// same name from shadowing the tag on raw.githubusercontent.com.
const releaseTag = `v${packageJson.version}`
const registryUrl = `https://raw.githubusercontent.com/p-otero/eskais-ui/refs/tags/${releaseTag}/public/r/{name}.json`

// The exact UI SDK beta every item pins; consumers keep the same one, since later betas can break.
const uiSdkVersion =
  items
    .flatMap((item) => item.dependencies ?? [])
    .find((dependency) => dependency.startsWith("@ui-sdk/react@"))
    ?.slice("@ui-sdk/react@".length) ?? "latest"

// Vercel's skills CLI installs the agent skills. Pinned to a release at least 7 days old, so pnpm dlx runs it under
// pnpm's default minimumReleaseAge, like the registry's own pins.
const skillsCliVersion = "1.8.1"

function findItem(name: string) {
  return items.find((item) => item.name === name)
}

export { componentItems, findItem, guideItems, items, registryUrl, releaseTag, skillsCliVersion, uiSdkVersion }
export type { RegistryFile, RegistryItem }
