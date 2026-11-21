import type { ComponentType, ReactNode } from "react"

import { usePerfMounted } from "../hooks/use-perf-mounted"

type Render = () => ReactNode

// Each scenario loads only its own file, so the vitals of the server fixtures count none of the others.
const collections = () => import("./perf-collections")
const blocks = () => import("./perf-blocks")
const overlays = () => import("./perf-overlays")
const server = () => import("./perf-server")

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
  "server-list": () =>
    server().then(({ ServerListScenario }) => () => <ServerListScenario />),
}

const scenario = new URLSearchParams(location.search).get("scenario") ?? "list-1k"

/** ?demo=perf&scenario=list-1k: the fixtures tooling/perf/run.mjs measures. */
function PerfPage({ render }: { render: Render | undefined }) {
  usePerfMounted()
  return (
    <main className="flex h-dvh flex-col gap-group p-inset-surface" data-perf-scenario={scenario}>
      {render ? render() : <p>Unknown scenario {scenario}</p>}
    </main>
  )
}

/** Loads the scenario's file, then starts the mount clock, so the mount time counts the render and not the download. */
async function loadPerfPage(): Promise<ComponentType> {
  const render = await scenarios[scenario]?.()
  globalThis.perfFixture = { scenario, start: performance.now() }
  return function PerfScenarioPage() {
    return <PerfPage render={render} />
  }
}

export { loadPerfPage }
