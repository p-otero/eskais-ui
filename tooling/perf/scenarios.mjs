const repeat = (key, times) => Array.from({ length: times }, () => key)
const chars = (text) => [...text].map((char) => (char === " " ? "Space" : char))

const boardSettle = 3500

const firstTabStop = (container) => `${container} [tabindex="0"]`

const ping = "[class~='motion-safe:animate-ping']"

async function css(page, content) {
  await page.addStyleTag({ content })
  await page.waitForTimeout(300)
}

async function glass(page) {
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "glass"))
  await page.waitForTimeout(400)
}

const keyScenarios = [
  {
    id: "list-1k",
    label: "List, 1,000 rows (j/k)",
    focus: '[data-slot="list-item"] [tabindex="0"]',
    keys: [...repeat("j", 60), ...repeat("k", 20)],
    held: "ArrowDown",
  },
  {
    id: "list-10k",
    label: "List, 10,000 rows virtualized (j/k)",
    focus: '[data-slot="list-item"] [tabindex="0"]',
    keys: [...repeat("j", 60), ...repeat("k", 20)],
    held: "ArrowDown",
  },
  {
    id: "table",
    label: "DataTable, 1,000 rows (↓/↑)",
    focus: 'tbody tr[tabindex="0"]',
    keys: [...repeat("ArrowDown", 60), ...repeat("ArrowUp", 20)],
    held: "ArrowDown",
  },
  {
    id: "table-cells",
    label: "DataTable, 1,000 rows, cell navigation (←↑→↓)",
    focus: 'tbody [role="gridcell"][tabindex="0"]',
    keys: [...repeat("ArrowRight", 3), ...repeat("ArrowDown", 40), ...repeat("ArrowLeft", 3), ...repeat("ArrowUp", 14)],
    held: "ArrowDown",
  },
  {
    id: "command",
    phase: "type",
    label: "Command, 300 items (typing)",
    focus: 'input[aria-label="Run a command"]',
    keys: [...chars("archive project"), ...repeat("Backspace", 15)],
  },
  {
    id: "command",
    phase: "arrows",
    label: "Command, 300 items (↓)",
    focus: 'input[aria-label="Run a command"]',
    keys: repeat("ArrowDown", 60),
    held: "ArrowDown",
  },
  {
    id: "menu",
    label: "Dropdown menu, 24 items (↓)",
    setup: async (page) => {
      await page.getByRole("button", { name: "Actions" }).click()
      await page.locator('[role="menu"]').waitFor()
      await page.waitForTimeout(300)
    },
    keys: repeat("ArrowDown", 48),
    held: "ArrowDown",
  },
  {
    id: "tabs",
    label: "Tabs, 12 tabs with panels (→)",
    focus: '[role="tab"][aria-selected="true"]',
    keys: repeat("ArrowRight", 24),
    held: "ArrowRight",
  },
  {
    id: "sidebar",
    label: "Sidebar, 60 links (Tab)",
    focus: '[data-slot="sidebar-item"]',
    keys: repeat("Tab", 40),
    held: "Tab",
  },
  {
    id: "board",
    label: "AgentTaskBoard, 200 cards (Tab past the cards)",
    settle: boardSettle,
    focus: "[data-task-select]",
    keys: repeat("Tab", 40),
    held: "Tab",
  },
  {
    id: "board",
    phase: "arrows",
    label: "AgentTaskBoard, 200 cards (j/k, ←/→)",
    settle: boardSettle,
    focus: '[data-task-select][tabindex="0"]',
    keys: [
      ...repeat("j", 12),
      ...repeat("ArrowRight", 4),
      ...repeat("k", 8),
      ...repeat("ArrowLeft", 4),
      ...repeat("j", 12),
    ],
    held: "ArrowDown",
  },
  {
    id: "board",
    phase: "glass",
    label: "AgentTaskBoard, 200 cards, glass theme (Tab)",
    settle: boardSettle,
    setup: glass,
    focus: "[data-task-select]",
    keys: repeat("Tab", 40),
  },
  {
    id: "shell",
    phase: "sidebar",
    label: "Shell, 60 routes (Tab through the sidebar)",
    focus: 'nav [aria-current="page"]',
    keys: repeat("Tab", 40),
    held: "Tab",
  },
  {
    id: "shell",
    phase: "palette",
    label: "Shell palette, 60 routes (typing)",
    setup: async (page) => {
      await page.getByRole("button", { name: "Search", exact: true }).first().click()
      await page.locator('input[aria-label="Find a page or command"]').waitFor()
    },
    focus: 'input[aria-label="Find a page or command"]',
    keys: [...chars("route 4"), ...repeat("Backspace", 7)],
  },
  {
    id: "master-detail",
    label: "MasterDetail, 500 rows, detail follows focus (j/k)",
    focus: '[data-slot="list-item"] [tabindex="0"]',
    keys: [...repeat("j", 40), ...repeat("k", 10)],
    held: "ArrowDown",
  },
  {
    id: "document-workspace",
    phase: "typing",
    label: "DocumentWorkspace, 150-heading note with outline (typing)",
    focus: ".cm-content",
    caretToEnd: true,
    keys: chars("the quick brown fox jumps over"),
  },
  {
    id: "document-workspace",
    phase: "explorer",
    label: "DocumentWorkspace explorer, 300 notes (Tab)",
    focus: 'a[href="#/note/note-0"]',
    keys: repeat("Tab", 40),
  },
  {
    id: "document-workspace",
    phase: "quick-open",
    label: "DocumentWorkspace quick open, 300 notes (typing)",
    setup: async (page) => {
      await page.locator(".cm-content").first().click()
      await page.keyboard.press("Control+p")
      await page.locator('[data-slot="dialog-content"] input').waitFor()
    },
    focus: '[data-slot="dialog-content"] input',
    keys: [...chars("note 12"), ...repeat("Backspace", 7)],
  },
  {
    id: "server-data-table",
    label: "ServerDataTable, 100 rows per page (↓/↑)",
    setup: (page) => page.locator('tbody tr[tabindex="0"]').first().waitFor(),
    focus: 'tbody tr[tabindex="0"]',
    keys: [...repeat("ArrowDown", 40), ...repeat("ArrowUp", 10)],
    held: "ArrowDown",
  },
  {
    id: "server-list",
    label: "ServerList, 312 rows (j/k)",
    setup: (page) => page.locator('[data-slot="list-item"] [tabindex="0"]').first().waitFor(),
    focus: '[data-slot="list-item"] [tabindex="0"]',
    keys: [...repeat("j", 40), ...repeat("k", 10)],
    held: "ArrowDown",
  },
  {
    id: "board",
    phase: "pulse-opacity",
    experiment: true,
    label: "AgentTaskBoard, pulse as opacity only (Tab)",
    setup: (page) =>
      css(
        page,
        `@keyframes perf-fade{50%{opacity:.15}} ${ping}{animation:perf-fade 1.6s ease-in-out infinite!important}`,
      ),
    focus: "[data-task-select]",
    keys: repeat("Tab", 40),
  },
  {
    id: "board",
    phase: "no-pulse",
    experiment: true,
    label: "AgentTaskBoard, no pulse (Tab)",
    setup: (page) => css(page, `${ping}{animation:none!important}`),
    focus: "[data-task-select]",
    keys: repeat("Tab", 40),
  },
  {
    id: "board-table",
    label: "AgentTaskBoard table, 200 rows (j/k)",
    focus: firstTabStop("tbody"),
    keys: [...repeat("j", 40), ...repeat("k", 10)],
    held: "ArrowDown",
  },
  {
    id: "calendar",
    label: "Calendar, 2 months (←↑→↓)",
    focus: '[data-slot="calendar-day"][tabindex="0"]',
    keys: [...repeat("ArrowRight", 20), ...repeat("ArrowDown", 10), ...repeat("ArrowLeft", 10)],
    held: "ArrowRight",
  },
  {
    id: "prism-picker",
    label: "PrismPicker (→, Page Up, ←)",
    focus: '[data-slot="prism-stage"] input[type="range"]',
    keys: [...repeat("ArrowRight", 8), ...repeat("PageUp", 6), ...repeat("ArrowLeft", 6)],
    held: "ArrowRight",
  },
  {
    id: "sun-arc",
    label: "SunArc (→, Page Up, ←)",
    focus: '[data-slot="sun-arc-stage"] input[type="range"]',
    keys: [...repeat("ArrowRight", 8), ...repeat("PageUp", 6), ...repeat("ArrowLeft", 6)],
    held: "ArrowRight",
  },
  {
    id: "sun-arc-photo",
    label: "SunArc over a photo (→, Page Up, ←)",
    settle: 2500,
    focus: '[data-slot="sun-arc-stage"] input[type="range"]',
    keys: [...repeat("ArrowRight", 8), ...repeat("PageUp", 6), ...repeat("ArrowLeft", 6)],
    held: "ArrowRight",
  },
  {
    id: "mixer",
    label: "Mixer, 6 channels (↑, Page Up, ↓)",
    focus: '[data-slot="mixer-desk"] input[type="range"]',
    keys: [...repeat("ArrowUp", 10), ...repeat("PageUp", 3), ...repeat("ArrowDown", 10)],
    held: "ArrowUp",
  },
  {
    id: "safe-dial",
    label: "SafeDial (→, ←, Enter)",
    focus: '[data-slot="safe-dial-dial"] input[type="range"]',
    keys: [...repeat("ArrowRight", 12), ...repeat("ArrowLeft", 6), "Enter", ...repeat("ArrowRight", 4)],
    held: "ArrowRight",
  },
  {
    id: "vinyl-scrubber",
    label: "VinylScrubber, 2,000 peaks (→, Page Up, ←)",
    focus: '[data-slot="vinyl-panel"] input[type="range"]',
    keys: [...repeat("ArrowRight", 10), ...repeat("PageUp", 4), ...repeat("ArrowLeft", 6)],
    held: "ArrowRight",
  },
  {
    id: "live-sky",
    label: "LiveSky, rain scrubbed (→, ←)",
    focus: 'input[type="range"]',
    keys: [...repeat("ArrowRight", 12), ...repeat("ArrowLeft", 8)],
    held: "ArrowRight",
  },
  {
    id: "teletext",
    label: "Teletext (digits to tune, → subpages)",
    focus: '[data-slot="teletext-page"]',
    keys: [...chars("101"), ...repeat("ArrowRight", 4), ...chars("400600100")],
    held: "ArrowRight",
  },
  {
    id: "retro-tv",
    label: "RetroTv, power off and on (Space)",
    focus: '[data-slot="retro-tv-power"]',
    keys: repeat("Space", 8),
  },
  {
    id: "pill-dialog",
    label: "PillDialog, open and cancel (Enter, Escape)",
    focus: '[data-slot="alert-dialog-trigger"]',
    keys: [..."ab".repeat(4)].map((key) => (key === "a" ? "Enter" : "Escape")),
  },
  {
    id: "ejector-button",
    label: "EjectorButton, cover open and shut (Space)",
    focus: '[data-slot="ejector-button-cover"]',
    keys: repeat("Space", 8),
  },
  {
    id: "log-viewer",
    label: "LogViewer, 10,000 lines (↑, PageUp, F8)",
    focus: '[data-slot="log-viewer-log"]',
    keys: [...repeat("ArrowUp", 30), ...repeat("PageUp", 10), ...repeat("F8", 6)],
    held: "ArrowUp",
  },
  {
    id: "typing",
    phase: "input",
    label: "Input (typing)",
    focus: 'input[aria-label="Plain input"]',
    keys: chars("the quick brown fox jumps"),
  },
  {
    id: "typing",
    phase: "combobox",
    label: "Combobox, 200 options (typing)",
    focus: 'input[aria-label="Owner"]',
    keys: [...chars("maya 1"), ...repeat("Backspace", 6), ...chars("sofia")],
  },
  {
    id: "typing",
    phase: "markdown",
    label: "MarkdownEditor, 40 sections (typing)",
    focus: ".cm-content",
    caretToEnd: true,
    keys: chars("the quick brown fox jumps over"),
  },
]

const overlays = [
  { name: "dialog", trigger: "Open dialog", content: '[data-slot="dialog-content"]' },
  { name: "popover", trigger: "Open popover", content: '[data-slot="popover-content"]' },
  { name: "menu", trigger: "Actions", content: '[role="menu"]' },
  { name: "command palette", trigger: "Open palette", content: '[data-slot="dialog-content"]' },
  { name: "drawer", trigger: "Open drawer", content: '[data-slot="drawer-content"]' },
  { name: "shell palette", scenario: "shell", trigger: "Search", content: '[data-slot="dialog-content"]' },
  {
    name: "workspace quick open",
    scenario: "document-workspace",
    shortcut: "Control+p",
    content: '[data-slot="dialog-content"]',
  },
]

const mountScenarios = [
  "empty",
  "list-1k",
  "list-10k",
  "table",
  "table-cells",
  "board",
  "board-table",
  "command",
  "typing",
  "shell",
  "master-detail",
  "document-workspace",
  "markdown-view",
  "server-data-table",
  "server-list",
  "log-viewer",
]

export { keyScenarios, mountScenarios, overlays }
