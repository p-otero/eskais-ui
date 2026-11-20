import { createChange, createController, definePrimitive, type ChangeDetails, type ChangeOptions } from "@ui-sdk/core"

import { settled } from "@/lib/action-refusal"

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
    const set = (collapsed: unknown, action: string, options?: ChangeOptions<SidebarCollapsedChangeReason>) => {
      if (typeof collapsed !== "boolean") throw new TypeError("setCollapsed takes true or false.")
      if (collapsed === context.store.get().collapsed) return true
      return settled(change("collapsed", collapsed, reasonOf(options)), action, reasonOf(options))
    }
    return {
      setCollapsed: (collapsed: unknown, options?: ChangeOptions<SidebarCollapsedChangeReason>) =>
        set(collapsed, "setCollapsed", options),
      collapse: (options?: ChangeOptions<SidebarCollapsedChangeReason>) => set(true, "collapse", options),
      expand: (options?: ChangeOptions<SidebarCollapsedChangeReason>) => set(false, "expand", options),
      toggle: (options?: ChangeOptions<SidebarCollapsedChangeReason>) =>
        set(!context.store.get().collapsed, "toggle", options),
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
