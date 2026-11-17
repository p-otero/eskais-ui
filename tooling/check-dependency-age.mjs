// Fails when an npm dependency pinned in registry.json is younger than 7 days: shadcn installs dependencies before
// it writes any file, so a consumer with a minimum release age (pnpm `minimumReleaseAge`) can't add the item at all.
// Usage: node tooling/check-dependency-age.mjs [--require-network]. Offline it skips, unless --require-network.
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

export const minimumAgeDays = 7
const day = 24 * 60 * 60 * 1000

// Pins allowed to be younger, each with its reason. One stays allowed only at this exact version: a bump has to be
// added here again on purpose. Once it is old enough the check says so, and the entry should go.
export const youngDependencyExceptions = {
  "@ui-sdk/core@0.1.0-beta.5":
    "UI SDK's first release is from 2026-11-12, so no version is 7 days old yet; the components are built on it",
  "@ui-sdk/react@0.1.0-beta.5":
    "UI SDK's first release is from 2026-11-12, so no version is 7 days old yet; the components are built on it",
}

// "name@1.2.3" or "@scope/name@1.2.3"; anything that isn't a registry version (github:, a URL) is not checked.
export function parseDependency(spec) {
  const at = spec.indexOf("@", 1)
  if (at === -1) return { name: spec, version: undefined }
  return { name: spec.slice(0, at), version: spec.slice(at + 1) }
}

export function registryDependencies(registry) {
  const specs = new Set()
  for (const item of registry.items)
    for (const spec of [...(item.dependencies ?? []), ...(item.devDependencies ?? [])]) specs.add(spec)
  return [...specs].toSorted()
}

const exactVersion = /^\d+\.\d+\.\d+(?:-[\w.]+)?$/
const notOnNpm = /^(?:github:|git\+|git:|https?:|file:|link:|workspace:)/

// `published` maps each "name@version" to its ISO publish time from the npm registry. Returns the pins that fail
// (`problems`) and the exceptions that are now old enough to remove (`matured`).
export function findYoungDependencies(
  specs,
  published,
  now,
  { minimumDays = minimumAgeDays, exceptions = youngDependencyExceptions } = {},
) {
  const problems = []
  const matured = []
  for (const spec of Object.keys(exceptions))
    if (!specs.includes(spec)) problems.push({ spec, reason: "is an exception but no item depends on it any more" })
  for (const spec of specs) {
    const { name, version } = parseDependency(spec)
    if (version !== undefined && notOnNpm.test(version)) continue
    if (version === undefined || !exactVersion.test(version)) {
      problems.push({ spec, reason: "not pinned to an exact version, so its age can't be checked" })
      continue
    }
    const time = published.get(`${name}@${version}`)
    if (time === undefined) {
      problems.push({ spec, reason: "not found on the npm registry" })
      continue
    }
    const age = (now - Date.parse(time)) / day
    const young = age < minimumDays
    if (young && !(spec in exceptions))
      problems.push({
        spec,
        reason: `published ${time.slice(0, 10)}, ${age.toFixed(1)} days ago (minimum ${String(minimumDays)})`,
      })
    if (!young && spec in exceptions) matured.push(spec)
  }
  return { problems, matured }
}

class OfflineError extends Error {}

async function fetchPublishTimes(specs) {
  const names = [...new Set(specs.map((spec) => parseDependency(spec).name))]
  const published = new Map()
  await Promise.all(
    names.map(async (name) => {
      let response
      try {
        response = await fetch(`https://registry.npmjs.org/${name.replace("/", "%2F")}`, {
          signal: AbortSignal.timeout(20_000),
        })
      } catch (error) {
        throw new OfflineError(`${name}: ${error.cause?.code ?? error.message}`)
      }
      if (response.status === 404) return
      if (!response.ok) throw new Error(`${name}: the npm registry answered ${String(response.status)}`)
      const { time = {} } = await response.json()
      for (const [version, at] of Object.entries(time)) published.set(`${name}@${version}`, at)
    }),
  )
  return published
}

async function main() {
  const requireNetwork = process.argv.includes("--require-network")
  const registry = JSON.parse(readFileSync(join(import.meta.dirname, "..", "registry.json"), "utf8"))
  const specs = registryDependencies(registry)
  let published
  try {
    published = await fetchPublishTimes(specs)
  } catch (error) {
    if (!(error instanceof OfflineError)) throw error
    const message = `registry.npmjs.org is unreachable (${error.message})`
    if (requireNetwork) {
      console.error(`The dependency age check failed: ${message}, and --require-network is set.`)
      process.exitCode = 1
    } else console.log(`Skipped the dependency age check: ${message}.`)
    return
  }
  const { problems, matured } = findYoungDependencies(specs, published, Date.now())
  for (const spec of matured)
    console.log(`${spec} is ${String(minimumAgeDays)} days old now: remove it from youngDependencyExceptions.`)
  if (problems.length === 0) {
    const allowed = Object.keys(youngDependencyExceptions).length - matured.length
    console.log(
      `The ${String(specs.length)} registry dependencies are at least ${String(minimumAgeDays)} days old` +
        (allowed > 0 ? `, apart from ${String(allowed)} listed exceptions.` : "."),
    )
    return
  }
  for (const { spec, reason } of problems) console.error(`${spec}: ${reason}`)
  console.error(
    `Pin a release at least ${String(minimumAgeDays)} days old (AGENTS.md "Dependencies"): consumers with a minimum release age can't install a younger one.`,
  )
  process.exitCode = 1
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main()
