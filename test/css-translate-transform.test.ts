import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { expect, test } from "vitest"

const styles = join(import.meta.dirname, "..", "registry", "styles")

function rulesDeclaringBoth(css: string) {
  const withoutComments = css.replaceAll(/\/\*[\s\S]*?\*\//g, "")
  const found: string[] = []
  for (const [, selector = "", body = ""] of withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const declares = (property: string) => new RegExp(`(^|[;\\s])${property}\\s*:`).test(body)
    if (declares("translate") && declares("transform")) found.push(selector.trim())
  }
  return found
}

test("lightningcss 1.33 drops `translate` from a rule that also sets `transform`, so no stylesheet declares both", () => {
  expect(rulesDeclaringBoth("a { left: 50%; translate: -50% 0; transform: rotateX(58deg); }")).toEqual(["a"])
  const offenders = readdirSync(styles)
    .filter((file) => file.endsWith(".css"))
    .flatMap((file) => rulesDeclaringBoth(readFileSync(join(styles, file), "utf8")).map((rule) => `${file}: ${rule}`))
  expect(offenders).toEqual([])
})
