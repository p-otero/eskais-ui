import { definePrimitive, dispatch, type ChangeDetails } from "@ui-sdk/core"

type DescriptionCopyDetails = ChangeDetails<"copy">

type DescriptionValueOptions = {
  /** The text `copy` writes to the clipboard. */
  text?: string
  onCopy?: (text: string, details: DescriptionCopyDetails) => void
}

const COPIED_FOR = 2000

// The CodeBlock copy pattern: the value's group is named by its term and gives agents `copy`; the button people press
// is hidden from them, so one value never shows up twice.
const descriptionValue = definePrimitive({
  name: "description-value",
  options: { text: "string", onCopy: "callback" },
  state: (options: DescriptionValueOptions) => ({ value: options.text ?? "", copied: false }),
  sync: (options) => ({ value: options.text ?? "" }),
  api: (context) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    context.onDestroy(() => clearTimeout(timer))
    let text = context.options().text
    context.onOptions((options) => {
      if (options.text === text) return
      text = options.text
      clearTimeout(timer)
      context.store.set({ copied: false })
    })
    return {
      /** Writes the value to the clipboard; resolves false where the page has no clipboard access or nothing to copy. */
      async copy(event?: Event) {
        const value = context.options().text ?? ""
        const clipboard = typeof navigator === "undefined" ? undefined : navigator.clipboard
        if (!clipboard || value === "") return false
        try {
          await clipboard.writeText(value)
        } catch {
          return false
        }
        clearTimeout(timer)
        context.store.set({ copied: true })
        timer = setTimeout(() => context.store.set({ copied: false }), COPIED_FOR)
        dispatch(context, "onCopy", value, { reason: "copy", event })
        return true
      },
    }
  },
  slots: (slot) => ({
    root: slot<{}, { copied: boolean }>({
      state: (state) => ({ copied: state.copied }),
      attrs: (state) => ({ role: "group", "data-copied": state.copied ? "" : undefined }),
    }),
  }),
  agent: { actions: ["copy"] },
})

export { descriptionValue }
export type { DescriptionCopyDetails, DescriptionValueOptions }
