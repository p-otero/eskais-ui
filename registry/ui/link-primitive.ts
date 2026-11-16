import { definePrimitive, dispatch, type ChangeDetails } from "@ui-sdk/core"

type LinkFollowDetails = ChangeDetails<"follow">

type LinkOptions = {
  href?: string
  onFollow?: (href: string, details: LinkFollowDetails) => void
}

function isPlainClick(event: MouseEvent) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
}

// UI SDK ships no link part, so a link is invisible to agents unless the app takes over following it. With
// `onFollow` the app decides what following means (a router push, a confirmation), for people and agents alike.
const link = definePrimitive({
  name: "link",
  options: { href: "string", onFollow: "callback" },
  state: (options: LinkOptions) => ({ value: options.href ?? "" }),
  sync: (options) => ({ value: options.href ?? "" }),
  api: (context) => ({
    follow(event?: Event) {
      const { href = "" } = context.options()
      return !dispatch(context, "onFollow", href, { reason: "follow", event })
    },
  }),
  slots: (slot) => ({
    root: slot({
      on: {
        click: (event, { api }) => {
          const mouse = event as MouseEvent
          if (mouse.defaultPrevented || !isPlainClick(mouse)) return
          mouse.preventDefault()
          api.follow(mouse)
        },
      },
    }),
  }),
  agent: { actions: ["follow"] },
})

export { isPlainClick, link }
export type { LinkFollowDetails, LinkOptions }
