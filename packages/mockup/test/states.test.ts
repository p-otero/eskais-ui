import { join } from "node:path"
import { describe, expect, test } from "vitest"

import { entrySource, pageTheme } from "../src/build"
import { parseVariant } from "../src/gallery"
import { stateOutName } from "../src/states"
import { outFor, renderRunner } from "../src/validate"

describe("states", () => {
  test("without a state, the page renders the screen with no props, as before", () => {
    const source = entrySource(false)
    expect(source).not.toContain("./fixtures")
    expect(source).toContain("createRoot(root).render(<Screen />)")
  })

  test("a state renders the screen with that state's props from fixtures.ts", () => {
    const source = entrySource(true, "empty")
    expect(source).toContain('import { states } from "./fixtures"')
    expect(source).toContain('createRoot(root).render(<Wrapper><Screen {...states["empty"]} /></Wrapper>)')
    expect(renderRunner(join("no", "such", "mockup"), "long-list")).toContain(
      'createElement(Screen, states["long-list"])',
    )
  })

  test("names each page out-<state>-<theme>.html, which the gallery reads back", () => {
    expect(stateOutName("long-list", pageTheme({ scheme: "dark" }))).toBe("out-long-list-dark.html")
    expect(stateOutName("empty", pageTheme({ theme: "compact", scheme: "light" }))).toBe("out-empty-compact.html")
    expect(parseVariant("out-long-list-system.html")).toEqual({ state: "long-list", theme: "system" })
  })

  test("--out takes {state} for every state, and needs it with more than one", () => {
    expect(outFor(undefined, "empty", ["empty", "error"])).toBeUndefined()
    expect(outFor("shots/out-{state}-dark.html", "error", ["empty", "error"])).toBe("shots/out-error-dark.html")
    expect(outFor("page.html", "empty", ["empty"])).toBe("page.html")
    expect(outFor("page.html", undefined, [undefined])).toBe("page.html")
    expect(() => outFor("page.html", "empty", ["empty", "error"])).toThrowError(/--out needs \{state\}/)
  })
})
