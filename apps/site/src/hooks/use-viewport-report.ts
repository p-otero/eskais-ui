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
    ["userAgent", navigator.userAgent],
  ]
}

function describe(element: Element | null) {
  if (!element || element === document.body) return "body"
  const label = element.getAttribute("aria-label") ?? element.getAttribute("name") ?? ""
  return `${element.tagName.toLowerCase()}${label ? ` "${label}"` : ""}`
}

let lastSheet: Row[] = [["sheet", "not opened yet"]]

function sheetRows(): Row[] {
  const sheet = document.querySelector<HTMLElement>("[data-viewport-debug-sheet]")
  // Keeps what it measured while open, not the frames of its exit transition.
  if (!sheet || sheet.hasAttribute("data-ending-style")) return lastSheet
  const rect = sheet.getBoundingClientRect()
  const style = getComputedStyle(sheet)
  const own = (name: string) => style.getPropertyValue(name).trim() || "unset"
  const visual = window.visualViewport
  const visibleBottom = visual ? visual.offsetTop + visual.height : window.innerHeight
  lastSheet = [
    ["sheet rect top / bottom / height", `${px(rect.top)} / ${px(rect.bottom)} / ${px(rect.height)}`],
    ["sheet bottom vs visible bottom", px(rect.bottom - visibleBottom)],
    ["computed top / bottom", `${style.top} / ${style.bottom}`],
    ["computed max-height", style.maxHeight],
    ["computed padding-bottom", style.paddingBottom],
    ["computed translate / transform", `${style.translate} / ${style.transform}`],
    ["--keyboard-inset (UI SDK)", own("--keyboard-inset")],
    ["--visual-viewport-height (UI SDK)", own("--visual-viewport-height")],
    [
      "--dialog-viewport-top / bottom / height",
      [own("--dialog-viewport-top"), own("--dialog-viewport-bottom"), own("--dialog-viewport-height")].join(" / "),
    ],
    ["data-keyboard (UI SDK)", String(sheet.hasAttribute("data-keyboard"))],
    ["data-dialog-keyboard", String(sheet.hasAttribute("data-dialog-keyboard"))],
    [
      "data-starting-style / ending",
      `${String(sheet.hasAttribute("data-starting-style"))} / ${String(sheet.hasAttribute("data-ending-style"))}`,
    ],
  ]
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

// Safari changes the viewport without always firing an event (its toolbars, a sheet's transition), so it also polls.
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

/** Live viewport measurements for the diagnostics page, and the last ones of its sample sheet. */
function useViewportReport() {
  return useSyncExternalStore(subscribe, snapshot, () => serverReport)
}

function formatReport(report: Report) {
  return [...report.page, ...report.sheet].map(([label, value]) => `${label}: ${value}`).join("\n")
}

export { formatReport, useViewportReport }
export type { Report, Row }
