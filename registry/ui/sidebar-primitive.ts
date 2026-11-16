import { createChange, createController, definePrimitive, type ChangeDetails, type ChangeOptions } from "@ui-sdk/core"

type SidebarCollapsedChangeReason = "trigger-press" | "imperative"

type SidebarOptions = {
  collapsed?: boolean
  defaultCollapsed?: boolean
  onCollapsedChange?: (collapsed: boolean, details: ChangeDetails<SidebarCollapsedChangeReason>) => void
  controller?: SidebarController
}

interface SidebarController {
  setCollapsed: (collapsed: boolean, options?: ChangeOptions<SidebarCollapsedChangeReason>) => boolean | undefined
  collapse: (options?: ChangeOptions<SidebarCollapsedChangeReason>) => boolean | undefined
  expand: (options?: ChangeOptions<SidebarCollapsedChangeReason>) => boolean | undefined
  toggle: (options?: ChangeOptions<SidebarCollapsedChangeReason>) => boolean | undefined
}

function reasonOf(options: unknown): { reason: SidebarCollapsedChangeReason; event?: Event } {
  if (typeof options !== "object" || options === null) return { reason: "imperative" }
  const { reason = "imperative", event } = options as ChangeOptions<SidebarCollapsedChangeReason>
  return { reason, event: event instanceof Event ? event : undefined }
}

const sidebar = definePrimitive({
  name: "sidebar",
  options: { collapsed: "boolean", defaultCollapsed: "boolean", onCollapsedChange: "callback", controller: "value" },
  state: (options: SidebarOptions) => ({ collapsed: options.collapsed ?? options.defaultCollapsed ?? false }),
  sync: (options) => (options.collapsed === undefined ? {} : { collapsed: options.collapsed }),
  controlled: ["collapsed"],
  api: (context) => {
    const change = createChange(context)
    const setCollapsed = (collapsed: unknown, options?: ChangeOptions<SidebarCollapsedChangeReason>) => {
      if (typeof collapsed !== "boolean") throw new TypeError("setCollapsed takes true or false.")
      if (collapsed === context.store.get().collapsed) return false
      return change("collapsed", collapsed, reasonOf(options))
    }
    return {
      setCollapsed,
      collapse: (options?: ChangeOptions<SidebarCollapsedChangeReason>) => setCollapsed(true, options),
      expand: (options?: ChangeOptions<SidebarCollapsedChangeReason>) => setCollapsed(false, options),
      toggle: (options?: ChangeOptions<SidebarCollapsedChangeReason>) =>
        setCollapsed(!context.store.get().collapsed, options),
    }
  },
  slots: (slot) => ({
    root: slot({
      role: "navigation",
      attrs: (state) => ({ "data-collapsed": state.collapsed ? "" : undefined }),
    }),
    trigger: slot({
      attrs: (state) => ({
        type: "button",
        "aria-expanded": String(!state.collapsed),
        "data-collapsed": state.collapsed ? "" : undefined,
      }),
      press: ({ api }, event) => api.toggle({ reason: "trigger-press", event }),
    }),
  }),
  agent: { actions: ["collapse", "expand", "toggle", "setCollapsed"] },
})

function createSidebarController() {
  return createController<SidebarController>()
}

export { createSidebarController, sidebar }
export type { SidebarCollapsedChangeReason, SidebarController, SidebarOptions }
