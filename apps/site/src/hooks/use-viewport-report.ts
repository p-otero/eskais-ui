import { useSyncExternalStore } from "react"

type Row = [label: string, value: string]
type Report = { page: Row[]; sheet: Row[] }

const px = (value: number) => `${String(Math.round(value * 100) / 100)}px`

function media(query: string) {
  return `${query}: ${String(window.matchMedia(`(${query})`).matches)}`
}

function pageRows(probe: HTMLElement | null): Row[] {
  const visual = window.visualViewport
  const safe = probe ? getComputedStyle(probe) : null
  const inset = (side: string) => safe?.getPropertyValue(`padding-${side}`) ?? "?"
  return [
    ["innerWidth × innerHeight", `${String(window.innerWidth)} × ${String(window.innerHeight)}`],
    ["visualViewport width × height", visual ? `${px(visual.width)} × ${px(visual.height)}` : "not supported"],
    ["visualViewport offsetTop / pageTop", visual ? `${px(visual.offsetTop)} / ${px(visual.pageTop)}` : "-"],
    ["visualViewport scale", visual ? String(visual.scale) : "-"],
    ["documentElement.clientHeight", String(document.documentElement.clientHeight)],
    ["layout probe (100% fixed) height", probe ? px(probe.getBoundingClientRect().height) : "?"],
    ["screen width × height", `${String(screen.width)} × ${String(screen.height)}`],
    ["devicePixelRatio", String(window.devicePixelRatio)],
    ["scrollY", String(Math.round(window.scrollY))],
    ["env(safe-area-inset-*) t r b l", ["top", "right", "bottom", "left"].map((side) => inset(side)).join(" ")],
    [
      "display-mode",
      ["standalone", "minimal-ui", "browser"]
        .filter((mode) => window.matchMedia(`(display-mode: ${mode})`).matches)
        .join(", ") || "none",
    ],
    ["pointer", [media("pointer: coarse"), media("pointer: fine"), media("hover: hover")].join(", ")],
    ["viewport meta", document.querySelector('meta[name="viewport"]')?.getAttribute("content") ?? "none"],
    ["focused", describe(document.activeElement)],
    focusedField(),
    ["userAgent", navigator.userAgent],
  ]
}

function describe(element: Element | null) {
  if (!element || element === document.body) return "body"
  const label = element.getAttribute("aria-label") ?? element.getAttribute("name") ?? ""
  const slot = element.getAttribute("data-slot")
  return `${element.tagName.toLowerCase()}${slot ? `[${slot}]` : ""}${label ? ` "${label}"` : ""}`
}

let lastSheet: Row[] = [["dialog", "none opened yet"]]

function openDialog() {
  return [...document.querySelectorAll<HTMLElement>("[role=dialog], [role=alertdialog]")].findLast((dialog) =>
    dialog.checkVisibility(),
  )
}

function nameOf(dialog: HTMLElement) {
  const title = dialog.getAttribute("aria-labelledby")
  return (title ? document.getElementById(title)?.textContent : null) ?? dialog.getAttribute("aria-label") ?? "?"
}

function renderedScale(element: HTMLElement) {
  return element.offsetHeight > 0 ? element.getBoundingClientRect().height / element.offsetHeight : 1
}

function measured(element: HTMLElement) {
  const rect = element.getBoundingClientRect()
  return `${px(rect.top)} / ${px(rect.bottom)} / ${px(rect.height)}, scroll ${String(element.scrollHeight)} / client ${String(element.clientHeight)}`
}

function partRows(dialog: HTMLElement): Row[] {
  const parts = [...dialog.querySelectorAll<HTMLElement>(":scope > *, :scope > * > *, [data-slot=dialog-body]")]
  return parts
    .filter((part) => (part.dataset.slot !== undefined || part instanceof HTMLFormElement) && part.checkVisibility())
    .map((part): Row => [
      `part ${part.dataset.slot ?? part.tagName.toLowerCase()} top / bottom / height`,
      measured(part),
    ])
}

function focusedField(): Row {
  const active = document.activeElement
  if (!(active instanceof HTMLElement) || active === document.body) return ["focused font-size", "-"]
  const size = Number.parseFloat(getComputedStyle(active).fontSize)
  return ["focused font-size (computed / as rendered)", `${px(size)} / ${px(size * renderedScale(active))}`]
}

function flags(element: Element, names: string[]) {
  return names.map((name) => `${name}: ${String(element.hasAttribute(name))}`).join(", ")
}

function variables(style: CSSStyleDeclaration, names: string[]) {
  return names.map((name) => style.getPropertyValue(name).trim() || "unset").join(" / ")
}

function sheetRows(): Row[] {
  const sheet = openDialog()
  if (!sheet || sheet.hasAttribute("data-ending-style")) return lastSheet
  const rect = sheet.getBoundingClientRect()
  const style = getComputedStyle(sheet)
  const visual = window.visualViewport
  const visibleTop = visual ? visual.offsetTop : 0
  const visibleBottom = visual ? visual.offsetTop + visual.height : window.innerHeight
  const ours = ["--dialog-viewport-top", "--dialog-viewport-bottom", "--dialog-viewport-height"]
  const sdk = ["--keyboard-inset", "--visual-viewport-height", "--visual-viewport-top"]
  const rows: Row[] = [
    ["dialog", `${nameOf(sheet)} (${sheet.dataset.slot ?? sheet.tagName.toLowerCase()})`],
    ["rect top / bottom / height", `${px(rect.top)} / ${px(rect.bottom)} / ${px(rect.height)}`],
    ["scroll height / client height", `${String(sheet.scrollHeight)} / ${String(sheet.clientHeight)}`],
    ["bottom past the visible bottom", px(rect.bottom - visibleBottom)],
    ["top above the visible top", px(visibleTop - rect.top)],
    ["computed top / bottom", `${style.top} / ${style.bottom}`],
    ["computed height / max-height", `${style.height} / ${style.maxHeight}`],
    ["computed padding-bottom", style.paddingBottom],
    ["computed translate / transform", `${style.translate} / ${style.transform}`],
    ["UI SDK --keyboard-inset / --visual-viewport-height / top", variables(style, sdk)],
    ["--dialog-viewport-top / bottom / height", variables(style, ours)],
    ["attributes", flags(sheet, ["data-keyboard", "data-dialog-keyboard", "data-starting-style", "data-ending-style"])],
    ["data-presentation / data-side", `${sheet.dataset.presentation ?? "-"} / ${sheet.dataset.side ?? "-"}`],
    ["focused", describe(document.activeElement)],
    focusedField(),
    ...partRows(sheet),
  ]
  const viewport = sheet.parentElement?.matches("[data-slot=drawer-viewport]") ? sheet.parentElement : null
  if (viewport) {
    const box = viewport.getBoundingClientRect()
    const own = getComputedStyle(viewport)
    rows.push(
      ["drawer viewport rect top / bottom", `${px(box.top)} / ${px(box.bottom)}`],
      ["drawer viewport computed top / bottom", `${own.top} / ${own.bottom}`],
      ["drawer viewport --keyboard-inset", own.getPropertyValue("--keyboard-inset").trim() || "unset"],
      ["drawer viewport --dialog-viewport-top / bottom / height", variables(own, ours)],
      ["drawer viewport data-keyboard", String(viewport.hasAttribute("data-keyboard"))],
    )
  }
  lastSheet = rows
  return lastSheet
}

let cached = ""
let cachedReport: Report = { page: [], sheet: [] }

function snapshot() {
  const report = { page: pageRows(document.getElementById("viewport-debug-probe")), sheet: sheetRows() }
  const key = JSON.stringify(report)
  if (key !== cached) {
    cached = key
    cachedReport = report
  }
  return cachedReport
}

const serverReport: Report = { page: [], sheet: [] }

// Workaround: Safari changes the viewport without always firing an event (its toolbars, a sheet's transition), so it also polls.
function subscribe(listener: () => void) {
  const visual = window.visualViewport
  const timer = window.setInterval(listener, 250)
  visual?.addEventListener("resize", listener)
  visual?.addEventListener("scroll", listener)
  window.addEventListener("resize", listener)
  window.addEventListener("scroll", listener)
  document.addEventListener("focusin", listener)
  return () => {
    window.clearInterval(timer)
    visual?.removeEventListener("resize", listener)
    visual?.removeEventListener("scroll", listener)
    window.removeEventListener("resize", listener)
    window.removeEventListener("scroll", listener)
    document.removeEventListener("focusin", listener)
  }
}

function currentReport() {
  return snapshot()
}

function useViewportReport() {
  return useSyncExternalStore(subscribe, snapshot, () => serverReport)
}

function formatReport(report: Report) {
  return [...report.page, ...report.sheet].map(([label, value]) => `${label}: ${value}`).join("\n")
}

export { currentReport, formatReport, useViewportReport }
export type { Report, Row }
