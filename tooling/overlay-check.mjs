// Drives the showcase's ?demo=overlay-check fixture in Chrome: a press right after a dialog starts closing
// reaches the page, and focus returns to the opener when a dialog unmounts while open or a field has autoFocus.
// Usage: node tooling/overlay-check.mjs (after `bun run build:showcase`)
import { withShowcase } from "./showcase-browser.mjs"

const failures = []

function check(label, ok, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? `: ${detail}` : ""}`)
  if (!ok) failures.push(label)
}

async function count(page) {
  return Number((await page.getByTestId("counter").textContent()).replace(/\D/g, ""))
}

// Runs the steps one after another: each drives the same page.
function inTurn(items, step) {
  return items.reduce((previous, item) => previous.then(() => step(item)), Promise.resolve())
}

async function focusedName(page) {
  return page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.textContent)
}

// The closing transition is stretched to 1.5s, so the press surely lands while it runs.
async function pressWhileClosing(page, { open, name, close, known }) {
  await page.getByRole("button", { name: open }).click()
  await page.getByRole("dialog", { name }).or(page.getByRole("alertdialog", { name })).waitFor()
  await page.waitForTimeout(1600)
  const before = await count(page)
  const box = await page.getByTestId("counter").boundingBox()
  await close()
  await page.mouse.click(box.x + box.width / 2, box.y + box.height - 6)
  const closing = await page.evaluate(() =>
    [...document.querySelectorAll("[data-ending-style]")].map(
      (part) => `${part.dataset.slot}=${getComputedStyle(part).pointerEvents}`,
    ),
  )
  await page.waitForTimeout(1600)
  const after = await count(page)
  check(
    `${name}: closing parts let presses through`,
    closing.length > 0 && closing.every((value) => value.endsWith("=none")),
    closing.join(" "),
  )
  const reached = after === before + 1
  if (known && !reached) {
    console.log(`known ${name}: a press while it closes is lost (${known})`)
    return
  }
  if (known) console.log(`note  ${name}: the known issue is gone, drop \`known\` here`)
  check(`${name}: a press while it closes reaches the page`, reached, `count ${before} -> ${after}`)
}

await withShowcase(async (page) => {
  await page.goto(`${new URL(page.url()).origin}/?demo=overlay-check`)
  await page.getByTestId("counter").waitFor()
  await page.addStyleTag({
    content: "[data-slot$=-backdrop], [data-slot$=dialog-content] { transition-duration: 1.5s !important }",
  })

  const escape = () => page.keyboard.press("Escape")
  await pressWhileClosing(page, { open: "Open dialog", name: "Plain dialog", close: escape })
  await pressWhileClosing(page, {
    open: "Open dialog",
    name: "Plain dialog",
    close: () => page.getByRole("button", { name: "Close dialog" }).click(),
  })
  await pressWhileClosing(page, { open: "Open confirm", name: "Archive project?", close: escape })
  await pressWhileClosing(page, {
    open: "Open drawer",
    name: "Plain drawer",
    close: escape,
    known: "UI SDK 0.1.0-beta.5's Drawer cancels pointerdown on the page while it slides out",
  })

  await page.getByRole("button", { name: "Open unmounting dialog" }).click()
  await page.getByRole("dialog", { name: "Unmounting dialog" }).waitFor()
  await page.getByRole("button", { name: "Done" }).click()
  await page.waitForTimeout(100)
  const unmounted = await focusedName(page)
  check("a dialog unmounted while open returns focus", unmounted === "Open unmounting dialog", unmounted)

  await page.getByRole("button", { name: "Open autofocus dialog" }).click()
  await page.getByRole("dialog", { name: "Autofocus dialog" }).waitFor()
  const autofocused = await focusedName(page)
  check("autoFocus takes focus on open", autofocused === "Name", autofocused)
  await page.keyboard.press("Escape")
  await page.waitForTimeout(1600)
  const returned = await focusedName(page)
  check("closing after autoFocus returns focus to the opener", returned === "Open autofocus dialog", returned)

  await inTurn(["", " by controller"], async (suffix) => {
    const opener = page.getByRole("button", { name: `Open handoff dialog${suffix}`, exact: true })
    const handoff = page.getByRole("dialog", { name: `Handoff dialog${suffix}`, exact: true })
    const thirdParty = page.getByRole("dialog", { name: "Third-party modal" })
    const closedBy = page.getByTestId(`third-party-closed${suffix.replaceAll(" ", "-")}`)
    const named = (name) => page.getByRole("button", { name: `${name}${suffix}`, exact: true })

    await opener.click()
    await handoff.waitFor()
    await page.waitForTimeout(1600)
    await named("Continue in a dialog").click()
    await page.getByRole("dialog", { name: `Second dialog${suffix}`, exact: true }).waitFor()
    await page.waitForTimeout(1600)
    const inSecond = await focusedName(page)
    check(
      `${suffix || "by trigger"}: a dialog opened while another closes keeps focus once that one has closed`,
      inSecond === `Second field${suffix}`,
      inSecond,
    )
    await page.keyboard.press("Escape")
    await page.waitForTimeout(1600)

    const ways = [
      {
        label: "a third-party modal opened from its close button",
        open: () => named("Continue in a third-party modal").click(),
      },
      {
        label: "a third-party modal opened 300ms into a close by Escape",
        open: async () => {
          await named("Then open a third-party modal").click()
          await page.keyboard.press("Escape")
        },
      },
      {
        label: "a third-party modal opened 300ms into a close by an outside press",
        open: async () => {
          await named("Then open a third-party modal").click()
          await page.mouse.click(10, 10)
        },
      },
    ]
    await inTurn(ways, async (way) => {
      await opener.click()
      await handoff.waitFor()
      await page.waitForTimeout(1600)
      await way.open()
      await page.waitForTimeout(1800)
      const open = await thirdParty.count()
      const on = await focusedName(page)
      check(
        `${suffix || "by trigger"}: ${way.label} keeps focus and stays open`,
        open === 1 && on === "Coupon",
        `open ${open}, closed by "${await closedBy.textContent()}", focus on ${on}`,
      )
      if (open) await page.getByRole("button", { name: "Close third-party modal" }).click()
      await page.waitForTimeout(200)
    })
  })
})

if (failures.length > 0) {
  console.error(`\n${failures.length} overlay check(s) failed`)
  process.exit(1)
}
