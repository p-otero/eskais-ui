import { createChange, definePrimitive, type ChangeDetails } from "@ui-sdk/core"

import { chalkboardBlocks, type ChalkboardContent } from "@/components/ui/chalkboard-content"
import { settled, unavailable } from "@/lib/action-refusal"

type ChalkboardOptions = {
  content?: ChalkboardContent
  defaultContent?: ChalkboardContent
  /** Asks to wipe the board and write this: an agent's `write`, or your code. `details.cancel()` keeps what's there. */
  onContentChange?: (content: ChalkboardContent, details: ChangeDetails<"imperative">) => void
}

const chalkboard = definePrimitive({
  name: "chalkboard",
  options: { content: "value", defaultContent: "value", onContentChange: "callback" },
  controlled: ["content"],
  state: (options: ChalkboardOptions): { content: ChalkboardContent } => ({
    content: options.content ?? options.defaultContent ?? [],
  }),
  sync: (options) => (options.content === undefined ? {} : { content: options.content }),
  api: (context) => {
    const change = createChange(context)
    return {
      /**
       * Wipes the board and writes `content`: blocks, or text with a line each (`# Heading`, `- item`,
       * `Coffee ... 2.50`, plain text).
       */
      write(content: unknown, event?: Event) {
        const blocks = chalkboardBlocks(content)
        if (!blocks) {
          return unavailable(
            "write",
            "takes text, a line each (# heading, - item, Coffee ... 2.50), or a list of heading, text, list and menu blocks",
            { event },
          )
        }
        const next = typeof content === "string" ? content : blocks
        return settled(change("content", next, { reason: "imperative", event }), "write", { event })
      },
    }
  },
  slots: (slot) => ({
    root: slot({ role: "region" }),
  }),
  agent: { actions: ["write"] },
})

export { chalkboard }
export type { ChalkboardOptions }
