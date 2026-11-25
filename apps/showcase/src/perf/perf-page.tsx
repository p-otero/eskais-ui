import type { ComponentType, ReactNode } from "react"

import { usePerfMounted } from "../hooks/use-perf-mounted"

type Render = () => ReactNode

// Perf: each scenario loads only its own file, so the vitals of the server fixtures count none of the others.
const collections = () => import("./perf-collections")
const blocks = () => import("./perf-blocks")
const overlays = () => import("./perf-overlays")
const server = () => import("./perf-server")
const prism = () => import("./perf-prism")
const instruments = () => import("./perf-instruments")
const sky = () => import("./perf-live-sky")
const signs = () => import("./perf-signs")
const retro = () => import("./perf-retro")

const scenarios: Record<string, () => Promise<Render>> = {
  "list-1k": () =>
    collections().then(({ ListScenario }) => () => <ListScenario count={1000} virtualize={false} />),
  "list-10k": () =>
    collections().then(({ ListScenario }) => () => <ListScenario count={10_000} virtualize="auto" />),
  table: () =>
    collections().then(({ TableScenario }) => () => <TableScenario />),
  "table-cells": () =>
    collections().then(({ TableScenario }) => () => <TableScenario navigation="cells" />),
  command: () =>
    overlays().then(({ CommandScenario }) => () => <CommandScenario />),
  menu: () =>
    overlays().then(({ MenuScenario }) => () => <MenuScenario />),
  tabs: () =>
    collections().then(({ TabsScenario }) => () => <TabsScenario />),
  sidebar: () =>
    collections().then(({ SidebarScenario }) => () => <SidebarScenario />),
  board: () =>
    collections().then(({ BoardScenario }) => () => <BoardScenario view="board" />),
  "board-table": () =>
    collections().then(({ BoardScenario }) => () => <BoardScenario view="table" />),
  calendar: () =>
    collections().then(({ CalendarScenario }) => () => <CalendarScenario />),
  "log-viewer": () =>
    collections().then(({ LogViewerScenario }) => () => <LogViewerScenario />),
  overlays: () =>
    overlays().then(({ OverlaysScenario }) => () => <OverlaysScenario />),
  typing: () =>
    overlays().then(({ TypingScenario }) => () => <TypingScenario />),
  shell: () =>
    blocks().then(({ ShellScenario }) => () => <ShellScenario />),
  "master-detail": () =>
    blocks().then(({ MasterDetailScenario }) => () => <MasterDetailScenario />),
  "document-workspace": () =>
    blocks().then(({ DocumentWorkspaceScenario }) => () => <DocumentWorkspaceScenario />),
  "markdown-view": () =>
    blocks().then(({ MarkdownViewScenario }) => () => <MarkdownViewScenario />),
  "server-data-table": () =>
    server().then(({ ServerDataTableScenario }) => () => <ServerDataTableScenario />),
  "prism-picker": () =>
    prism().then(({ PrismPickerScenario }) => () => <PrismPickerScenario />),
  "sun-arc": () =>
    instruments().then(({ SunArcScenario }) => () => <SunArcScenario />),
  "sun-arc-photo": () =>
    instruments().then(({ SunArcPhotoScenario }) => () => <SunArcPhotoScenario />),
  mixer: () =>
    instruments().then(({ MixerScenario }) => () => <MixerScenario />),
  "safe-dial": () =>
    instruments().then(({ SafeDialScenario }) => () => <SafeDialScenario />),
  "vinyl-scrubber": () =>
    instruments().then(({ VinylScrubberScenario }) => () => <VinylScrubberScenario />),
  "live-sky": () =>
    sky().then(({ LiveSkyScenario }) => () => <LiveSkyScenario />),
  teletext: () =>
    signs().then(({ TeletextScenario }) => () => <TeletextScenario />),
  "retro-tv": () =>
    retro().then(({ RetroTvScenario }) => () => <RetroTvScenario />),
  "pill-dialog": () =>
    retro().then(({ PillDialogScenario }) => () => <PillDialogScenario />),
  "ejector-button": () =>
    retro().then(({ EjectorButtonScenario }) => () => <EjectorButtonScenario />),
  "server-list": () =>
    server().then(({ ServerListScenario }) => () => <ServerListScenario />),
}

const scenario = new URLSearchParams(location.search).get("scenario") ?? "list-1k"

function PerfPage({ render }: { render: Render | undefined }) {
  usePerfMounted()
  return (
    <main className="flex h-dvh flex-col gap-group p-inset-surface" data-perf-scenario={scenario}>
      {render ? render() : <p>Unknown scenario {scenario}</p>}
    </main>
  )
}

// Perf: loads the scenario's file before the mount clock starts, so the mount time counts the render, not the download.
async function loadPerfPage(): Promise<ComponentType> {
  const render = await scenarios[scenario]?.()
  globalThis.perfFixture = { scenario, start: performance.now() }
  return function PerfScenarioPage() {
    return <PerfPage render={render} />
  }
}

export { loadPerfPage }
