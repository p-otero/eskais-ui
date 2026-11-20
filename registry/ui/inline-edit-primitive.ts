import {
  createChange,
  createInlineEdit,
  definePrimitive,
  type ChangeDetails,
  type InlineEditReason,
} from "@ui-sdk/core"

import { settled, unavailable } from "@/lib/action-refusal"

type InlineEditOptions = {
  value?: string
  defaultValue?: string
  /** Runs when a new text is saved: Enter, Tab, leaving the field (with `blur="commit"`) or an agent's `rename`. */
  onValueChange?: (value: string, details: ChangeDetails<InlineEditReason>) => void
  /** Return `false` to keep editing, like for an empty name. */
  validate?: (text: string) => boolean
  /** What leaving the field does: `"commit"` saves what it holds (the default), `"cancel"` puts the text back. */
  blur?: "commit" | "cancel"
  /** `"press"` (the default) starts editing on a press of the text; `"double-click"` leaves a press to the host, like selecting a row. */
  startOn?: "press" | "double-click"
  disabled?: boolean
}

const EDITED = "value"

const inlineEdit = definePrimitive({
  name: "inline-edit",
  options: {
    value: "string",
    defaultValue: "string",
    onValueChange: "callback",
    validate: "value",
    blur: "string",
    startOn: "string",
    disabled: "boolean",
  },
  state: (options: InlineEditOptions) => ({
    value: options.value ?? options.defaultValue ?? "",
    editing: null as string | null,
    disabled: options.disabled ?? false,
    blur: options.blur ?? "commit",
    startOn: options.startOn ?? "press",
  }),
  sync: (options) => ({
    ...(options.value === undefined ? {} : { value: options.value }),
    disabled: options.disabled ?? false,
    blur: options.blur ?? "commit",
    startOn: options.startOn ?? "press",
  }),
  api: (context) => {
    const change = createChange(context)
    // After Enter or Escape the text's element replaces the field, so focus goes back to it once it binds.
    let returnFocus = false
    const edit = createInlineEdit(context, {
      key: "editing",
      value: () => context.store.get().value,
      disabled: () => context.store.get().disabled,
      commit: (_id, text, details) => {
        if (context.options().validate?.(text) === false) return false
        if (text === context.store.get().value) return true
        return change("value", text, details)
      },
    })
    return {
      edit,
      /** Starts editing, like a press on the text or its edit button. */
      start(event?: Event) {
        return edit.start(EDITED, { reason: "imperative", event })
      },
      /** Saves a new text at once, without opening the field. */
      rename(text: string) {
        if (context.store.get().disabled) return unavailable("rename", "isn't available while disabled")
        if (context.options().validate?.(text) === false) return settled(false, "rename")
        edit.cancel()
        if (text === context.store.get().value) return true
        return settled(change("value", text, { reason: "imperative" }), "rename")
      },
      /** Stops editing and puts the text back. */
      cancel() {
        if (edit.editing(context.store.get()) === null)
          return unavailable("cancel", "isn't available while not editing")
        edit.cancel()
        return true
      },
      inputKeydown(event: KeyboardEvent) {
        const { key } = event
        if (!edit.inputKeydown(event)) return
        if (key === "Escape") event.stopPropagation()
        if (key === "Enter" || key === "Escape") returnFocus = true
      },
      takeReturnFocus() {
        const wanted = returnFocus
        returnFocus = false
        return wanted
      },
    }
  },
  slots: (slot) => ({
    root: slot<{}, { editing: boolean; value: string }>({
      role: "group",
      state: (state) => ({ editing: state.editing !== null, value: state.value }),
      attrs: (state) => ({
        "data-editing": state.editing === null ? undefined : "",
        "data-disabled": state.disabled ? "" : undefined,
      }),
    }),
    display: slot({
      role: "button",
      focus: "native",
      present: (state) => state.editing === null,
      press: ({ api, store }, event) => {
        if (store.get().startOn === "press") api.start(event)
      },
      attrs: (state) => ({ type: "button", "aria-disabled": state.disabled ? "true" : undefined }),
      on: {
        keydown: (event, { api }) => {
          if (api.edit.keydown(event as KeyboardEvent, EDITED)) event.preventDefault()
        },
        dblclick: (event, { api }) => api.edit.dblclick(event as MouseEvent, EDITED),
      },
      bind: (el, part) => {
        if (part.api.takeReturnFocus()) el.focus()
      },
    }),
    trigger: slot({
      role: "button",
      focus: "native",
      present: (state) => state.editing === null,
      press: ({ api }, event) => api.start(event),
      attrs: (state) => ({ type: "button", disabled: state.disabled ? "" : undefined }),
    }),
    input: slot({
      present: (state) => state.editing !== null,
      attrs: (state) => ({ disabled: state.disabled ? "" : undefined }),
      on: {
        keydown: (event, { api }) => api.inputKeydown(event as KeyboardEvent),
        focusout: (event, { api, store }) => {
          if (store.get().blur === "cancel") api.cancel()
          else api.edit.end("focus-out", event)
        },
      },
      bind: (el, part) => part.api.edit.bindInput(el as HTMLInputElement),
    }),
  }),
  agent: { actions: ["rename", "cancel"] },
})

export { inlineEdit }
export type { InlineEditOptions, InlineEditReason }
