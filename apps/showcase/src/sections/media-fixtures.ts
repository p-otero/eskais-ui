import type { LightboxItem } from "@/components/ui/lightbox"

type Scheme = "light" | "dark"
type Layout = "dashboard" | "form" | "mobile" | "chart"

const palette = {
  light: { page: "#f6f7f9", panel: "#ffffff", line: "#e3e6eb", text: "#1d2330", muted: "#8a93a3", soft: "#eef1f5" },
  dark: { page: "#11141a", panel: "#1a1f28", line: "#2a313d", text: "#e7eaf0", muted: "#6f7889", soft: "#232a35" },
}

function bars(x: number, y: number, width: number, color: string, muted: string) {
  return [0.62, 0.44, 0.8, 0.36, 0.7, 0.52]
    .map((ratio, index) => {
      const h = Math.round(ratio * 160)
      return `<rect x="${x + index * (width / 6)}" y="${y + 160 - h}" width="${width / 6 - 14}" height="${h}" rx="6" fill="${index === 2 ? color : muted}"/>`
    })
    .join("")
}

function body(layout: Layout, width: number, height: number, c: (typeof palette)["light"], accent: string) {
  if (layout === "mobile") {
    return `<rect x="24" y="24" width="${width - 48}" height="56" rx="14" fill="${c.panel}" stroke="${c.line}"/>
      ${[0, 1, 2, 3, 4]
        .map(
          (
            row,
          ) => `<rect x="24" y="${104 + row * 96}" width="${width - 48}" height="80" rx="14" fill="${c.panel}" stroke="${c.line}"/>
        <circle cx="64" cy="${144 + row * 96}" r="18" fill="${row === 1 ? accent : c.soft}"/>
        <rect x="96" y="${130 + row * 96}" width="${width * 0.45}" height="10" rx="5" fill="${c.text}"/>
        <rect x="96" y="${150 + row * 96}" width="${width * 0.3}" height="8" rx="4" fill="${c.muted}"/>`,
        )
        .join("")}
      <rect x="24" y="${height - 96}" width="${width - 48}" height="56" rx="28" fill="${accent}"/>`
  }
  const side = `<rect x="0" y="0" width="220" height="${height}" fill="${c.panel}" stroke="${c.line}"/>
    ${[0, 1, 2, 3, 4, 5]
      .map(
        (row) =>
          `<rect x="24" y="${96 + row * 44}" width="${row === 1 ? 172 : 120}" height="28" rx="8" fill="${row === 1 ? accent : "transparent"}" opacity="${row === 1 ? 0.9 : 1}"/><rect x="36" y="${106 + row * 44}" width="${80 + (row % 3) * 18}" height="8" rx="4" fill="${row === 1 ? c.panel : c.muted}"/>`,
      )
      .join("")}
    <rect x="24" y="32" width="120" height="16" rx="8" fill="${c.text}"/>`
  const header = `<rect x="252" y="32" width="${width * 0.28}" height="18" rx="9" fill="${c.text}"/>
    <rect x="${width - 168}" y="24" width="136" height="36" rx="10" fill="${accent}"/>`
  if (layout === "form") {
    return `${side}${header}
      <rect x="252" y="88" width="${width - 284}" height="${height - 120}" rx="16" fill="${c.panel}" stroke="${c.line}"/>
      ${[0, 1, 2, 3]
        .map(
          (row) => `<rect x="284" y="${124 + row * 92}" width="120" height="10" rx="5" fill="${c.text}"/>
        <rect x="284" y="${146 + row * 92}" width="${width * 0.42}" height="40" rx="10" fill="${c.page}" stroke="${row === 2 ? "#e5484d" : c.line}" stroke-width="${row === 2 ? 2 : 1}"/>`,
        )
        .join("")}
      <rect x="284" y="${height - 104}" width="${width * 0.42}" height="40" rx="10" fill="#e5484d" opacity="0.14"/>
      <rect x="300" y="${height - 89}" width="${width * 0.3}" height="10" rx="5" fill="#e5484d"/>`
  }
  const cards = [0, 1, 2]
    .map(
      (
        index,
      ) => `<rect x="${252 + index * ((width - 284) / 3)}" y="88" width="${(width - 284) / 3 - 16}" height="104" rx="14" fill="${c.panel}" stroke="${c.line}"/>
      <rect x="${276 + index * ((width - 284) / 3)}" y="112" width="72" height="8" rx="4" fill="${c.muted}"/>
      <rect x="${276 + index * ((width - 284) / 3)}" y="136" width="110" height="22" rx="6" fill="${c.text}"/>`,
    )
    .join("")
  const chartTop = 216
  return `${side}${header}${cards}
    <rect x="252" y="${chartTop}" width="${width - 284}" height="${height - chartTop - 32}" rx="16" fill="${c.panel}" stroke="${c.line}"/>
    ${layout === "chart" ? bars(284, chartTop + 48, width - 360, accent, c.soft) : ""}
    ${
      layout === "dashboard"
        ? [0, 1, 2, 3, 4]
            .map(
              (
                row,
              ) => `<rect x="284" y="${chartTop + 32 + row * 52}" width="${width - 348}" height="1" fill="${c.line}"/>
          <circle cx="300" cy="${chartTop + 58 + row * 52}" r="7" fill="${row === 0 ? accent : c.muted}"/>
          <rect x="320" y="${chartTop + 53 + row * 52}" width="${width * 0.3}" height="10" rx="5" fill="${c.text}"/>
          <rect x="${width - 180}" y="${chartTop + 51 + row * 52}" width="96" height="14" rx="7" fill="${c.soft}"/>`,
            )
            .join("")
        : ""
    }`
}

function screenshot(layout: Layout, scheme: Scheme, width: number, height: number, accent = "#3e63dd") {
  const c = palette[scheme]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="${c.page}"/>${body(layout, width, height, c, accent)}</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function themed(layout: Layout, width: number, height: number, accent?: string) {
  return {
    src: screenshot(layout, "light", width, height, accent),
    srcDark: screenshot(layout, "dark", width, height, accent),
  }
}

const screenshots: LightboxItem[] = [
  {
    id: "overview",
    name: "overview.png",
    alt: "Project overview with three stat cards and recent activity",
    ...themed("dashboard", 1440, 900),
  },
  {
    id: "import-error",
    name: "import-error.png",
    alt: "Import form showing a validation error on the file field",
    ...themed("form", 1440, 900, "#30a46c"),
  },
  {
    id: "usage-chart",
    name: "usage-chart.png",
    alt: "Weekly usage chart with Wednesday highlighted",
    ...themed("chart", 1600, 1000, "#8e4ec6"),
  },
  {
    id: "mobile",
    name: "mobile-inbox.png",
    alt: "Inbox on a phone, second message unread",
    ...themed("mobile", 390, 760),
  },
]

export { screenshot, screenshots, themed }
