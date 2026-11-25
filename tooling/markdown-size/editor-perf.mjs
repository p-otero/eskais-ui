import { withShowcase } from "../showcase-browser.mjs"

const slowdown = Number(process.argv[2] ?? 4)

function note(lines) {
  const out = []
  for (let n = 1; out.length < lines; n++) {
    out.push(
      `## Section ${n}`,
      "",
      `Paragraph ${n} with **bold**, _italic_, \`code\`, a [link](https://example.com/${n}) and [[note-${n}]].`,
      "",
    )
    out.push(`- [ ] task ${n}`, `- [x] done ${n}`, "  - nested item with ~~strike~~", "")
    out.push("| a | b | c |", "| --- | :-: | --: |", `| ${n} | x | y |`, "")
    out.push("```ts", `const value${n}: number = ${n}`, "```", "", `> quote ${n}`, "")
  }
  return `${out.slice(0, lines).join("\n")}\n`
}

const percentile = (list, p) => {
  const sorted = list.toSorted((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]
}
const ms = (value) => `${value.toFixed(1)} ms`
const summary = (list) => `p50 ${ms(percentile(list, 50))}, p95 ${ms(percentile(list, 95))}`

await withShowcase(async (page) => {
  const client = await page.context().newCDPSession(page)
  await page.getByRole("textbox", { name: "Release notes" }).scrollIntoViewIfNeeded()
  await page.evaluate(() => {
    // oxlint-disable-next-line unicorn/consistent-function-scoping -- runs in the page, which can't see this module
    const frame = () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve)))
    window.mdPerf = { keys: [], longTasks: [], states: [], updates: [] }
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.mdPerf.longTasks.push(entry.duration)
    }).observe({ type: "longtask" })
    window.addEventListener(
      "keydown",
      (event) => void frame().then(() => window.mdPerf.keys.push(performance.now() - event.timeStamp)),
      true,
    )
  })
  await client.send("Emulation.setCPUThrottlingRate", { rate: slowdown })

  const markdown = note(5000)
  const paste = await page.evaluate(async (text) => {
    const content = document.querySelector(".cm-content")
    const view = content.cmTile.root.view
    view.focus()
    view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } })
    const data = new DataTransfer()
    data.setData("text/plain", text)
    const start = performance.now()
    content.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }))
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve)))
    const pasted = performance.now() - start
    view.dispatch({ selection: { anchor: view.state.doc.line(2500).to }, scrollIntoView: true })
    // oxlint-disable-next-line unicorn/consistent-function-scoping -- runs in the page, which can't see this module
    const time = (list, run) => {
      const begin = performance.now()
      const result = run()
      list.push(performance.now() - begin)
      return result
    }
    const update = view.update.bind(view)
    view.update = (transactions) => time(window.mdPerf.updates, () => update(transactions))
    const prototype = Object.getPrototypeOf(view.state)
    const create = prototype.update
    prototype.update = function (...specs) {
      return time(window.mdPerf.states, () => create.apply(this, specs))
    }
    return { pasted, lines: view.state.doc.lines, bytes: text.length }
  }, markdown)
  await page.waitForTimeout(1500)
  await page.evaluate(() => (window.mdPerf = { keys: [], longTasks: [], states: [], updates: [] }))

  const steps = Array.from({ length: 48 }, (_, index) => index)
  await steps.reduce(
    (previous, index) =>
      previous
        .then(() => page.keyboard.press(index % 6 === 5 ? "Backspace" : "x"))
        .then(() => page.waitForTimeout(index % 6 === 5 ? 570 : 120)),
    Promise.resolve(),
  )
  await page.waitForTimeout(500)
  const { keys, longTasks, states, updates } = await page.evaluate(() => window.mdPerf)
  const domLines = await page.evaluate(() => document.querySelectorAll(".cm-content .cm-line").length)
  await client.send("Emulation.setCPUThrottlingRate", { rate: 1 })

  console.log(`CPU ×${slowdown}, ${paste.lines} lines (${(paste.bytes / 1024).toFixed(0)} KB), ${domLines} in the DOM`)
  console.log(`paste the whole note → next frame: ${ms(paste.pasted)}`)
  console.log(`keystroke → frame (${keys.length} keys): ${summary(keys)}, max ${ms(Math.max(...keys))}`)
  console.log(`  state update ${summary(states)}; view update ${summary(updates)}`)
  const longest = longTasks.length ? `, longest ${ms(Math.max(...longTasks))}` : ""
  if (process.env.KEYS) console.log(keys.map((key) => Math.round(key)).join(" "))
  console.log(`long tasks while typing: ${longTasks.length}${longest}`)
})
