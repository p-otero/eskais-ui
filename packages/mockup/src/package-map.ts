// Node's package `imports` and `exports` maps: exact keys, one-star patterns (longest prefix wins),
// condition objects in key order and fallback arrays, as in the PACKAGE_TARGET_RESOLVE algorithm.

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

// The source of an app's own files, as TypeScript's bundler resolution and Bun read them. "types" is left out
// so a map that sends types to a dist folder still leads to the sources.
export const SOURCE_CONDITIONS = ["browser", "import", "module", "bun", "development", "default", "node", "require"]

export const STYLE_CONDITIONS = ["style", "default"]

export function targetOf(value: unknown, conditions: readonly string[]): string | null {
  if (typeof value === "string") return value
  if (Array.isArray(value)) {
    for (const entry of value) {
      const target = targetOf(entry, conditions)
      if (target !== null) return target
    }
    return null
  }
  if (!isRecord(value)) return null
  for (const [key, entry] of Object.entries(value)) {
    if (!conditions.includes(key)) continue
    const target = targetOf(entry, conditions)
    if (target !== null) return target
  }
  return null
}

export function matchMap(map: unknown, specifier: string, conditions: readonly string[]): string | null {
  if (!isRecord(map)) return null
  if (Object.hasOwn(map, specifier) && !specifier.includes("*")) return targetOf(map[specifier], conditions)
  let best: { key: string; star: string } | null = null
  for (const key of Object.keys(map)) {
    const star = key.indexOf("*")
    if (star === -1 || key.indexOf("*", star + 1) !== -1) continue
    const prefix = key.slice(0, star)
    const suffix = key.slice(star + 1)
    if (!specifier.startsWith(prefix) || specifier.length < key.length) continue
    if (suffix !== "" && !specifier.endsWith(suffix)) continue
    if (best !== null && best.key.indexOf("*") >= prefix.length) continue
    best = { key, star: specifier.slice(prefix.length, specifier.length - suffix.length) }
  }
  if (best === null) return null
  const target = targetOf(map[best.key], conditions)
  return target === null ? null : target.replaceAll("*", best.star)
}

const PROBE = "__eskais_mockup_probe__"

// The folder an alias such as "#components/ui" stands for: the folder its files resolve into.
export function mappedDirectory(map: unknown, specifier: string, conditions: readonly string[]): string | null {
  const probed = matchMap(map, `${specifier}/${PROBE}`, conditions)
  if (probed?.includes(PROBE)) return probed.slice(0, probed.indexOf(PROBE)).replace(/\/$/, "")
  return matchMap(map, specifier, conditions)
}

// The prefixes an import has to start with to go through the map: "#components/" for "#components/*".
export function mapPrefixes(map: unknown): string[] {
  if (!isRecord(map)) return []
  return Object.keys(map).map((key) => (key.includes("*") ? key.slice(0, key.indexOf("*")) : key))
}

// The alias folders a map declares: "#components/*" → "#components", for a project without components.json.
export function mapAliases(map: unknown, conditions: readonly string[]): { specifier: string; target: string }[] {
  if (!isRecord(map)) return []
  const found: { specifier: string; target: string }[] = []
  for (const key of Object.keys(map)) {
    if (!key.endsWith("/*")) continue
    const specifier = key.slice(0, -2)
    const target = mappedDirectory(map, specifier, conditions)
    if (target !== null) found.push({ specifier, target })
  }
  return found
}
