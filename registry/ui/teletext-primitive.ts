import { createChange, definePrimitive, type ChangeDetails } from "@ui-sdk/core"

import {
  fastextColors,
  firstPage,
  lastPage,
  subpageCount,
  type FastextColor,
  type TeletextPage,
} from "@/components/ui/teletext-page"
import { settled, unavailable } from "@/lib/action-refusal"
import { isOneOf } from "@/lib/narrow"

/** Why the page changed: three digits typed (`digit-key`), a coloured key (`fastext-press`), an agent or your code. */
type TeletextPageChangeReason = "digit-key" | "fastext-press" | "imperative"

type TeletextOptions = {
  /** The service's pages by number, 100 to 899. */
  pages?: Readonly<Record<number, TeletextPage>>
  page?: number
  defaultPage?: number
  /** Asks to tune to another page; `details.cancel()` stays on this one. */
  onPageChange?: (page: number, details: ChangeDetails<TeletextPageChangeReason>) => void
}

type Call = { reason: TeletextPageChangeReason; event?: Event | undefined }

const pageNumbers = (pages: Readonly<Record<number, TeletextPage>>) =>
  Object.keys(pages)
    .map(Number)
    .toSorted((a, b) => a - b)

function listed(numbers: number[]) {
  if (numbers.length <= 8) return numbers.join(", ")
  return `${numbers.slice(0, 8).join(", ")} and ${String(numbers.length - 8)} more`
}

const teletext = definePrimitive({
  name: "teletext",
  options: { pages: "value", page: "number", defaultPage: "number", onPageChange: "callback" },
  controlled: ["page"],
  state: (options: TeletextOptions) => ({
    page: options.page ?? options.defaultPage ?? pageNumbers(options.pages ?? {})[0] ?? firstPage,
    entry: "",
    subpage: 0,
  }),
  sync: (options) => (options.page === undefined ? {} : { page: options.page }),
  api: (context) => {
    const change = createChange(context)
    const pagesNow = () => context.options().pages ?? {}

    const tune = (page: number, action: string, call: Call) => {
      if (!Number.isInteger(page) || page < firstPage || page > lastPage) {
        return unavailable(
          action,
          `takes a page from ${String(firstPage)} to ${String(lastPage)}, not ${String(page)}`,
          call,
        )
      }
      if (!pagesNow()[page]) {
        return unavailable(
          action,
          `can't find page ${String(page)}: this service has ${listed(pageNumbers(pagesNow()))}`,
          call,
        )
      }
      context.store.set({ entry: "" })
      if (context.store.get().page === page) return true
      const tuned = settled(change("page", page, call), action, call)
      if (tuned) context.store.set({ subpage: 0 })
      return tuned
    }

    const api = {
      /** Tunes to a page, 100 to 899, as typing its three digits on the remote does. */
      goToPage(page: number, event?: Event) {
        return tune(page, "goToPage", { reason: "imperative", event })
      },
      /** Presses a coloured key: red, green, yellow or blue, which goes where the page's bottom row says. */
      fastext(color: FastextColor, event?: Event) {
        const call: Call = event ? { reason: "fastext-press", event } : { reason: "imperative" }
        if (!isOneOf(fastextColors, color)) {
          return unavailable("fastext", `takes red, green, yellow or blue, not ${String(color)}`, call)
        }
        const { page } = context.store.get()
        const link = pagesNow()[page]?.fastext?.[color]
        if (!link) return unavailable("fastext", `has no ${color} link on page ${String(page)}`, call)
        return tune(link.page, "fastext", call)
      },
      /** Adds a digit to the page number being typed; the third one tunes. */
      type(digit: string, event: Event) {
        const entry = context.store.get().entry
        const next = (entry.length >= 3 ? "" : entry) + digit
        context.store.set({ entry: next })
        if (next.length === 3) tune(Number(next), "goToPage", { reason: "digit-key", event })
      },
      /** Shows the next subpage, or the one before with -1, round the page's subpages. */
      turnSubpage(step: 1 | -1) {
        const { page, subpage } = context.store.get()
        const count = subpageCount(pagesNow()[page])
        context.store.set({ subpage: (subpage + step + count) % count })
      },
    }
    return api
  },
  slots: (slot) => ({
    root: slot({ role: "group" }),
    page: slot({
      role: "region",
      attrs: (state) => ({
        tabindex: "0",
        "aria-keyshortcuts": "0 1 2 3 4 5 6 7 8 9",
        "data-entry": state.entry || undefined,
      }),
      on: {
        keydown: (event, { api, store }) => {
          if (event.altKey || event.ctrlKey || event.metaKey) return
          if (/^\d$/.test(event.key)) {
            event.preventDefault()
            api.type(event.key, event)
          } else if (event.key === "Backspace" && store.get().entry) {
            event.preventDefault()
            store.set({ entry: store.get().entry.slice(0, -1) })
          } else if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
            event.preventDefault()
            api.turnSubpage(event.key === "ArrowRight" ? 1 : -1)
          }
        },
      },
    }),
  }),
  agent: { actions: ["goToPage", "fastext"] },
})

export { teletext }
export type { TeletextOptions, TeletextPageChangeReason }
