import type { ReactNode } from "react"

import { usePerfMounted } from "../hooks/use-perf-mounted"

import {
  BoardScenario,
  CalendarScenario,
  ListScenario,
  LogViewerScenario,
  SidebarScenario,
  TableScenario,
  TabsScenario,
} from "./perf-collections"
import { DocumentWorkspaceScenario, MarkdownViewScenario, MasterDetailScenario, ShellScenario } from "./perf-blocks"
import { ServerDataTableScenario, ServerListScenario } from "./perf-server"
import { CommandScenario, MenuScenario, OverlaysScenario, TypingScenario } from "./perf-overlays"

const scenarios: Record<string, () => ReactNode> = {
  "list-1k": () => <ListScenario count={1000} virtualize={false} />,
  "list-10k": () => <ListScenario count={10_000} virtualize="auto" />,
  table: () => <TableScenario />,
  "table-cells": () => <TableScenario navigation="cells" />,
  command: () => <CommandScenario />,
  menu: () => <MenuScenario />,
  tabs: () => <TabsScenario />,
  sidebar: () => <SidebarScenario />,
  board: () => <BoardScenario view="board" />,
  "board-table": () => <BoardScenario view="table" />,
  calendar: () => <CalendarScenario />,
  "log-viewer": () => <LogViewerScenario />,
  overlays: () => <OverlaysScenario />,
  typing: () => <TypingScenario />,
  shell: () => <ShellScenario />,
  "master-detail": () => <MasterDetailScenario />,
  "document-workspace": () => <DocumentWorkspaceScenario />,
  "markdown-view": () => <MarkdownViewScenario />,
  "server-data-table": () => <ServerDataTableScenario />,
  "server-list": () => <ServerListScenario />,
}

const scenario = new URLSearchParams(location.search).get("scenario") ?? "list-1k"
globalThis.perfFixture = { scenario, start: performance.now() }

/** ?demo=perf&scenario=list-1k: the fixtures tooling/perf/run.mjs measures. */
function PerfPage() {
  usePerfMounted()
  const render = scenarios[scenario]
  return (
    <main className="flex h-dvh flex-col gap-group p-inset-surface" data-perf-scenario={scenario}>
      {render ? render() : <p>Unknown scenario {scenario}</p>}
    </main>
  )
}

export { PerfPage }
