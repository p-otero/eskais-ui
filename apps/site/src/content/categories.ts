const categories = [
  {
    name: "Foundations",
    items: ["appearance", "tone", "button", "kbd", "separator", "label"],
  },
  {
    name: "Forms",
    items: [
      "form",
      "form-dialog",
      "field",
      "input",
      "textarea",
      "number-input",
      "otp-input",
      "search-field",
      "select",
      "native-select",
      "combobox",
      "checkbox",
      "radio-group",
      "switch",
      "slider",
      "toggle",
      "toggle-group",
      "segmented-control",
      "calendar",
      "date-picker",
      "date-time-picker",
    ],
  },
  {
    name: "Overlays",
    items: [
      "dialog",
      "confirm-dialog",
      "drawer",
      "popover",
      "tooltip",
      "hover-card",
      "dropdown-menu",
      "context-menu",
      "command",
      "lightbox",
    ],
  },
  {
    name: "Navigation",
    items: [
      "link",
      "site-header",
      "topbar",
      "mobile-nav",
      "sidebar",
      "navigation-menu",
      "menubar",
      "breadcrumb",
      "pagination",
      "tabs",
      "skip-link",
    ],
  },
  {
    name: "Layout",
    items: [
      "page-layout",
      "page-header",
      "section",
      "card",
      "accordion",
      "collapsible",
      "scroll-area",
      "resizable",
      "floating",
      "carousel",
      "board",
    ],
  },
  {
    name: "Data",
    items: [
      "table",
      "data-table",
      "filter-bar",
      "chart",
      "stat",
      "list-item",
      "stage-track",
      "avatar",
      "badge",
      "dependency-chips",
      "attachments",
      "quantity",
      "relative-time",
    ],
  },
  {
    name: "Feedback",
    items: ["alert", "toast", "status-pill", "spinner", "skeleton", "progress", "meter", "empty", "states"],
  },
  {
    name: "Agent tasks",
    items: [
      "agent-task-board",
      "agent-task-board-core",
      "task-card",
      "task-detail-panel",
      "proposal-actions",
      "attempt-timeline",
      "acceptance-list",
      "agent-badge",
      "liveness-indicator",
      "task-status",
      "usage",
      "agent-task-types",
    ],
  },
  {
    name: "Blocks",
    items: ["landing-page", "hero", "section-heading", "bento", "steps", "site-footer", "docs-layout"],
  },
  {
    name: "Editor",
    items: ["code-block", "markdown-editor", "markdown-view", "markdown-editor-languages"],
  },
] as const

type CategoryName = (typeof categories)[number]["name"]

function categoryOf(name: string): CategoryName | undefined {
  return categories.find((category) => (category.items as readonly string[]).includes(name))?.name
}

export { categories, categoryOf }
export type { CategoryName }
