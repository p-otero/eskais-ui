import { definePrimitive } from "@ui-sdk/core"

import { unavailable } from "@/lib/action-refusal"

type FormRootOptions = {
  /** Whether the form has an accessible name, so an agent can find it. */
  named?: boolean
  /** Whether submitting needs a person (a destructive submit): agents then press the submit button instead. */
  confirm?: boolean
  onResetRequest?: () => void
}

const formRoot = definePrimitive({
  name: "form",
  options: { named: "boolean", confirm: "boolean", onResetRequest: "callback" },
  state: (options: FormRootOptions) => ({ named: Boolean(options.named), confirm: Boolean(options.confirm) }),
  sync: (options) => ({ named: Boolean(options.named), confirm: Boolean(options.confirm) }),
  api: (context) => ({
    submit() {
      const form = context.element("root")
      if (!(form instanceof HTMLFormElement))
        return unavailable("submit", "isn't available: the form isn't on the page")
      form.requestSubmit()
      return true
    },
    reset() {
      const onResetRequest = context.options().onResetRequest
      if (!onResetRequest) return unavailable("reset", "isn't offered: there is no onResetRequest")
      onResetRequest()
      return true
    },
  }),
  slots: (slot) => ({
    root: slot({}),
  }),
  agent: { actions: ["submit", "reset"], shown: (state) => state.named && !state.confirm },
})

export { formRoot }
export type { FormRootOptions }
