import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ThemedImage } from "@/components/ui/themed-image"

import htmlDark from "./html-dark.webp"
import htmlLight from "./html-light.webp"
import tsxDark from "./tsx-dark.webp"
import tsxLight from "./tsx-light.webp"

type Row = { metric: string; html: string; tsx: string; change: string }

const results: Row[] = [
  { metric: "Model calls", html: "93", tsx: "63", change: "−32%" },
  { metric: "Output tokens", html: "143k", tsx: "56.5k", change: "−60%" },
  { metric: "of which reasoning", html: "96.9k", tsx: "38.3k", change: "−60%" },
  { metric: "Uncached input tokens", html: "239k", tsx: "152k", change: "−36%" },
  { metric: "Cache read tokens", html: "13.9M", tsx: "5.84M", change: "−58%" },
  { metric: "Cost (API-equivalent)", html: "$0.163", tsx: "$0.074", change: "−55%" },
  { metric: "Wall time (approx.)", html: "~28 min", tsx: "~12 min", change: "−57%" },
  {
    metric: "Agent deliverable",
    html: "89.6 KB, 2,720 lines of HTML",
    tsx: "21 KB screen.tsx + 1.5 KB fixtures.ts",
    change: "",
  },
  { metric: "Built page", html: "90 KB", tsx: "887 KB (components and fonts inlined)", change: "" },
]

const shots = [
  {
    title: "A: hand-written HTML",
    light: htmlLight,
    dark: htmlDark,
    width: 1200,
    height: 640,
    alt: "The API keys screen written as one HTML file: an app bar, a page header with Create key, Active and Revoked tabs, and a table of four keys with scope badges and row menus.",
  },
  {
    title: "B: TSX with @eskais/mockup",
    light: tsxLight,
    dark: tsxDark,
    width: 1200,
    height: 458,
    alt: "The same API keys screen built from the project's own components: a page header with Create key, Active and Revoked tabs, and a card with a table of four keys, scope badges and row menus.",
  },
]

function ResultsTable() {
  return (
    <Table aria-label="Benchmark results: hand-written HTML against @eskais/mockup TSX" className="text-body-sm">
      <TableHeader>
        <TableRow>
          <TableHead scope="col">Measure</TableHead>
          <TableHead scope="col">A: hand-written HTML</TableHead>
          <TableHead scope="col">B: @eskais/mockup TSX</TableHead>
          <TableHead scope="col">B vs A</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {results.map((row) => (
          <TableRow key={row.metric}>
            <TableHead scope="row" className="font-medium text-foreground">
              {row.metric}
            </TableHead>
            <TableCell className="tabular-nums">{row.html}</TableCell>
            <TableCell className="tabular-nums">{row.tsx}</TableCell>
            <TableCell className="tabular-nums">{row.change}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function Screenshots() {
  return (
    <div className="grid grid-cols-2 gap-group narrow:grid-cols-1">
      {shots.map((shot) => (
        <figure key={shot.title} className="flex min-w-0 flex-col gap-items">
          <ThemedImage
            src={shot.light}
            srcDark={shot.dark}
            alt={shot.alt}
            width={shot.width}
            height={shot.height}
            loading="lazy"
            className="h-auto w-full rounded-surface border bg-card"
          />
          <figcaption className="text-caption text-muted-foreground">{shot.title}</figcaption>
        </figure>
      ))}
    </div>
  )
}

export { ResultsTable, Screenshots }
