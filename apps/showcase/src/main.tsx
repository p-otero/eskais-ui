import { StrictMode, type ComponentType } from "react"
import { createRoot } from "react-dom/client"

import { Appearance } from "@/components/ui/appearance"
import { LiquidLens } from "@/components/ui/liquid-lens"

import { appearance } from "./appearance"
import { loadPerfPage } from "./perf/perf-page"
import { gitWorkspaceDemoNames } from "./sections/git-workspace/names"
import "./index.css"

const root = document.getElementById("root")
if (!root) throw new Error("Missing #root element")

const params = new URLSearchParams(location.search)
const demo = params.get("demo")

// Perf: each page loads apart, so a page downloads only its own demo: the perf server sends files uncompressed on a slow 4G
// profile, where every byte before the first paint is LCP. The page renders once loaded, with no Suspense fallback
// before it: React holds a boundary's content for 300 ms after its fallback shows.
type Page = () => Promise<ComponentType>

const pages: Record<string, Page> = {
  page: () =>
    Promise.all([import("./sections/page"), import("@/components/ui/skip-link")]).then(
      ([{ demoStatuses, PageDemo }, { SkipLink }]) => {
        const status = demoStatuses.find((name) => name === params.get("status")) ?? "success"
        return function Page() {
          return (
            <>
              <SkipLink>Skip to content</SkipLink>
              <PageDemo status={status} as="main" />
            </>
          )
        }
      },
    ),
  site: () => import("./shell/site-demo").then((module) => module.SiteDemo),
  shell: () => import("./shell/shell-demo").then((module) => module.ShellDemo),
  "overlay-check": () => import("./checks/overlay-check").then((module) => module.OverlayCheck),
  "dialog-mobile-check": () => import("./checks/dialog-mobile-check").then((module) => module.DialogMobileCheck),
  "dialog-matrix-check": () => import("./checks/dialog-matrix-check").then((module) => module.DialogMatrixCheck),
  "sortable-check": () => import("./checks/sortable-check").then((module) => module.SortableCheck),
  "tree-focus-check": () => import("./checks/tree-focus-check").then((module) => module.TreeFocusCheck),
  "git-view-check": () => import("./checks/git-view-check").then((module) => module.GitViewCheck),
  "voice-input-check": () => import("./checks/voice-input-check").then((module) => module.VoiceInputCheck),
  "agent-bridge-check": () => import("./checks/agent-bridge-check").then((module) => module.AgentBridgeCheck),
  "card-header-check": () => import("./checks/card-header-check").then((module) => module.CardHeaderCheck),
  "palette-reopen-check": () => import("./checks/palette-reopen-check").then((module) => module.PaletteReopenCheck),
  "field-placement-check": () => import("./checks/field-placement-check").then((module) => module.FieldPlacementCheck),
  "mobile-nav-check": () => import("./checks/mobile-nav-check").then((module) => module.MobileNavCheck),
  "icon-tooltip-check": () => import("./checks/icon-tooltip-check").then((module) => module.IconTooltipCheck),
  inbox: () => import("./sections/inbox").then((module) => module.InboxDemo),
  "list-bench": () => import("./checks/list-bench").then((module) => module.ListBench),
  "log-bench": () => import("./checks/log-bench").then((module) => module.LogBench),
  "log-viewer": () =>
    import("./sections/log-viewer").then(({ LogViewerDemo }) => {
      return function LogViewerPage() {
        return (
          <main className="flex h-dvh flex-col p-inset-surface">
            <LogViewerDemo className="min-h-0 flex-1" />
          </main>
        )
      }
    }),
  "diff-bench": () => import("./checks/diff-bench").then((module) => module.DiffBench),
  "calendar-check": () => import("./checks/calendar-check").then((module) => module.CalendarCheck),
  "press-check": () => import("./checks/press-check").then((module) => module.PressCheck),
  "color-picker-check": () => import("./checks/color-picker-check").then((module) => module.ColorPickerCheck),
  "popover-check": () => import("./checks/popover-check").then((module) => module.PopoverCheck),
  "task-dialog": () =>
    import("./sections/task-dialog").then(({ TaskDialogPage }) => {
      return function TaskDialog() {
        return <TaskDialogPage params={params} />
      }
    }),
  "side-panel-check": () => import("./checks/side-panel-check").then((module) => module.SidePanelCheck),
  "table-check": () => import("./checks/table-check").then((module) => module.TableCheck),
  "description-list-check": () =>
    import("./checks/description-list-check").then((module) => module.DescriptionListCheck),
  "gauge-check": () => import("./checks/gauge-check").then((module) => module.GaugeCheck),
  "image-scan-check": () => import("./checks/image-scan-check").then((module) => module.ImageScanCheck),
  "model-check": () => import("./checks/model-check").then((module) => module.ModelCheck),
  "master-detail": () => import("./sections/layout-blocks/master-detail").then((module) => module.MasterDetailDemo),
  "list-row-actions": () =>
    import("./sections/layout-blocks/list-row-actions").then((module) => module.ListRowActionsDemo),
  "master-detail-check": () => import("./checks/master-detail-check").then((module) => module.MasterDetailCheck),
  "dashboard-grid": () => import("./sections/layout-blocks/dashboard-grid").then((module) => module.DashboardGridDemo),
  "settings-page": () => import("./sections/layout-blocks/settings-page").then((module) => module.SettingsPageDemo),
  "settings-page-check": () => import("./checks/settings-page-check").then((module) => module.SettingsPageCheck),
  "shell-block": () => import("./shell/shell-block-demo").then((module) => module.ShellBlockDemo),
  "auth-page": () => import("./sections/auth/auth-page").then((module) => module.AuthPageDemo),
  "account-menu": () => import("./sections/auth/account-menu").then((module) => module.AccountMenuDemo),
  "invitation-panel": () => import("./sections/auth/invitation-panel").then((module) => module.InvitationPanelDemo),
  "pairing-code": () => import("./sections/auth/pairing-code").then((module) => module.PairingCodeDemo),
  "device-approval": () => import("./sections/auth/device-approval").then((module) => module.DeviceApprovalDemo),
  "secret-list": () => import("./sections/auth/secret-list").then((module) => module.SecretListDemo),
  "document-workspace": () => import("./sections/document-workspace").then((module) => module.DocumentWorkspacePage),
  "server-data-check": () => import("./checks/server-data-check").then((module) => module.ServerDataCheck),
  "agent-workspace": () =>
    Promise.all([import("./sections/agent-workspace"), import("@/components/ui/toast")]).then(
      ([{ AgentWorkspace }, { ToastStack }]) => {
        return function AgentWorkspacePage() {
          return (
            <main className="p-inset-surface">
              <AgentWorkspace />
              <ToastStack />
            </main>
          )
        }
      },
    ),
  "commit-bench": () =>
    import("./checks/git-bench").then(({ GitBench }) => {
      return function CommitBench() {
        return <GitBench kind="commits" />
      }
    }),
  "git-tree-bench": () =>
    import("./checks/git-bench").then(({ GitBench }) => {
      return function GitTreeBench() {
        return <GitBench kind="files" />
      }
    }),
  "commit-branches": () =>
    import("./sections/git").then(({ CommitBranchesDemo }) => {
      return function CommitBranches() {
        return (
          <main className="flex min-h-dvh items-start justify-center bg-background p-inset-surface">
            <CommitBranchesDemo />
          </main>
        )
      }
    }),
  "commit-history": () =>
    import("./sections/git").then(({ CommitTrailDemo }) => {
      return function CommitHistory() {
        return (
          <main className="flex min-h-dvh items-start justify-center bg-background p-inset-surface">
            <CommitTrailDemo />
          </main>
        )
      }
    }),
  perf: loadPerfPage,
  "prism-picker": () => import("./prism/prism-picker-demo").then((module) => module.PrismPickerDemo),
  "sun-arc": () => import("./instruments/sun-arc-demo").then((module) => module.SunArcDemo),
  mixer: () => import("./instruments/mixer-demo").then((module) => module.MixerDemo),
  "safe-dial": () => import("./instruments/safe-dial-demo").then((module) => module.SafeDialDemo),
  "liquid-glass": () => import("./liquid/liquid-glass-demo").then((module) => module.LiquidGlassDemo),
  "vinyl-scrubber": () => import("./instruments/vinyl-scrubber-demo").then((module) => module.VinylScrubberDemo),
  "live-sky": () => import("./sky/live-sky-demo").then((module) => module.LiveSkyDemo),
  "led-matrix": () => import("./signs/led-matrix-demo").then((module) => module.LedMatrixDemo),
  "neon-sign": () => import("./signs/neon-sign-demo").then((module) => module.NeonSignDemo),
  chalkboard: () => import("./signs/chalkboard-demo").then((module) => module.ChalkboardDemo),
  teletext: () => import("./signs/teletext-demo").then((module) => module.TeletextDemo),
  "teletext-tv": () => import("./signs/teletext-tv-demo").then((module) => module.TeletextTvDemo),
  "retro-tv": () => import("./retro/retro-tv-demo").then((module) => module.RetroTvDemo),
  "pill-dialog": () => import("./retro/pill-dialog-demo").then((module) => module.PillDialogDemo),
  ...Object.fromEntries(
    gitWorkspaceDemoNames.map((name) => [
      name,
      () =>
        import("./sections/git-workspace/demos").then(({ GitWorkspaceDemo }) => {
          return function GitWorkspacePage() {
            return <GitWorkspaceDemo name={name} />
          }
        }),
    ]),
  ),
}

const loadApp: Page = () => import("./app").then((module) => module.App)
const load = demo !== null && Object.hasOwn(pages, demo) ? pages[demo] : undefined

void (load ?? loadApp)().then((Loaded) => {
  createRoot(root).render(
    <StrictMode>
      {load ? (
        <Appearance appearance={appearance}>
          <Loaded />
        </Appearance>
      ) : (
        <Loaded />
      )}
      <LiquidLens />
    </StrictMode>,
  )
})
