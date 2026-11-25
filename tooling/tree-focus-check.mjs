import { withShowcase } from "./showcase-browser.mjs"

const failures = []

function check(label, ok, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? `: ${detail}` : ""}`)
  if (!ok) failures.push(label)
}

function outlined(page, scope, part) {
  return page.evaluate(
    ([scopeSelector, partSelector]) => {
      const tree = document.querySelector(scopeSelector)
      if (!tree) return { found: false, rows: 0, outlined: [], ownsFocus: false }
      const parts = [...tree.querySelectorAll(partSelector)]
      const drawn = parts.filter((element) => {
        const style = getComputedStyle(element)
        const outline = style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) > 0
        return outline || style.boxShadow !== "none"
      })
      const focused = document.activeElement
      return {
        found: true,
        rows: parts.length,
        outlined: drawn.map((element) => element.textContent?.trim().slice(0, 40)),
        ownsFocus: drawn.length === 1 && drawn[0]?.parentElement === focused,
        focusedRole: focused?.getAttribute("role") ?? focused?.tagName.toLowerCase(),
      }
    },
    [scope, part],
  )
}

async function tabIntoTree(page, scope, presses = 12) {
  if (presses === 0) return false
  await page.keyboard.press("Tab")
  const inside = await page.evaluate(
    (selector) =>
      document.activeElement?.getAttribute("role") === "treeitem" && document.activeElement.closest(selector) !== null,
    scope,
  )
  return inside || tabIntoTree(page, scope, presses - 1)
}

async function checkTree(page, mode, name, { scope, part, before }) {
  if (before) await page.getByTestId(before).focus()
  await page.waitForTimeout(150)
  const resting = await outlined(page, scope, part)
  check(`${mode} ${name}: rows render`, resting.found && resting.rows > 2, `${String(resting.rows)} rows`)
  check(
    `${mode} ${name}: no row outlined before a row has focus`,
    resting.outlined.length === 0,
    resting.outlined.join(" | "),
  )
  check(`${mode} ${name}: Tab reaches a row`, await tabIntoTree(page, scope))
  await page.waitForTimeout(150)
  const focused = await outlined(page, scope, part)
  check(
    `${mode} ${name}: exactly the focused row is outlined`,
    focused.outlined.length === 1 && focused.ownsFocus,
    focused.outlined.join(" | "),
  )
}

async function checkMode(page, mode) {
  await page.goto(`${new URL(page.url()).origin}/?demo=tree-focus-check`)
  await page.evaluate((dark) => {
    document.documentElement.classList.toggle("dark", dark)
    document.documentElement.classList.toggle("light", !dark)
  }, mode === "dark")

  await page.getByRole("button", { name: "Open diff" }).focus()
  await page.keyboard.press("Enter")
  const dialog = page.getByRole("dialog", { name: "Changes" })
  await dialog.waitFor()
  await page.waitForTimeout(300)
  const popupFocused = await page.evaluate(
    () => document.activeElement?.getAttribute("role") === "dialog" && document.activeElement.matches(":focus-visible"),
  )
  check(`${mode} dialog: the popup has visible focus`, popupFocused)
  await checkTree(page, mode, "GitDiff file tree in a dialog", {
    scope: '[role="dialog"] [role="tree"]',
    part: '[data-slot="tree-label"]',
  })
  await page.keyboard.press("Escape")
  await dialog.waitFor({ state: "hidden" })

  await checkTree(page, mode, "GitTree", {
    scope: '[role="tree"][aria-label="Git tree"]',
    part: '[data-slot="tree-label"]',
    before: "before-git-tree",
  })
  await checkTree(page, mode, "Tree", {
    scope: '[role="tree"][aria-label="Tree"]',
    part: '[data-slot="tree-label"]',
    before: "before-tree",
  })
  await checkTree(page, mode, "CommitHistory", {
    scope: '[role="tree"][aria-label="Commits"]',
    part: '[data-slot="commit-row"] > span[aria-hidden="true"]',
    before: "before-commits",
  })
}

await withShowcase(async (page) => {
  await checkMode(page, "light")
  await checkMode(page, "dark")
})

if (failures.length > 0) {
  console.error(`\n${String(failures.length)} tree focus checks failed:\n${failures.join("\n")}`)
  process.exit(1)
}
console.log("\nTree focus checks passed")
