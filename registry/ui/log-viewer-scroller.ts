import { createVirtualizer } from "@ui-sdk/core"

import { layersBesideViewport } from "@/components/ui/scroll-area-layers"

// How close to the end, in px, still counts as at the end: a fraction of a row, so a scroll of one line lets go.
const END_TOLERANCE = 4

type LogScrollerOptions = {
  count: () => number
  key: (position: number) => string
  /** Positions that stay rendered wherever the log is scrolled, like the current error. */
  keep: () => readonly number[]
  following: () => boolean
  /** Called when the reader scrolls to or away from the end. */
  setFollowing: (following: boolean) => void
  onKeyDown: (event: KeyboardEvent) => void
}

/**
 * The log's scroller: UI SDK's virtualizer over the shown lines, the box that holds their height, and following the
 * end. Rows are one line high until lines wrap: the height comes from an element styled like a row, and only
 * wrapped rows are measured one by one.
 */
function createLogScroller(options: LogScrollerOptions) {
  let rowHeight = 20
  let scroller: HTMLElement | undefined
  let rows: HTMLElement | undefined
  let written = -1
  // The scroll position this code last set, so its own scroll event isn't read as the reader scrolling.
  let ownScroll: number | undefined

  const virtual = createVirtualizer({
    count: options.count,
    estimate: () => rowHeight,
    key: options.key,
    overscan: 12,
    keep: options.keep,
  })

  const writeSize = () => {
    const size = virtual.size()
    if (!rows || size === written) return
    written = size
    rows.style.height = `${String(size)}px`
  }

  const setTop = (top: number) => {
    if (!scroller) return
    scroller.scrollTop = top
    ownScroll = scroller.scrollTop
  }

  // The box grows first, so the browser doesn't clamp the new position to the old height; the virtualizer then
  // reads the new position, and the rows at the end render in the same frame.
  const toEnd = () => {
    if (!scroller) return
    writeSize()
    const end = scroller.scrollHeight - scroller.clientHeight
    if (Math.abs(scroller.scrollTop - end) < 1) return
    setTop(end)
    virtual.refresh()
  }

  return {
    virtual,
    rowHeight: () => rowHeight,
    connected: () => scroller !== undefined,
    /** Reads the shown lines again after they changed, and keeps the end in view while following. */
    refresh(removedAbove = 0, averageRow = rowHeight) {
      virtual.refresh()
      writeSize()
      if (!scroller) return
      if (options.following()) toEnd()
      // Lines that left the buffer above the view would pull the text up under the reader: scroll by as much.
      else if (removedAbove > 0) {
        setTop(Math.max(0, scroller.scrollTop - removedAbove * averageRow))
        virtual.refresh()
      }
    },
    resize() {
      virtual.reset()
      virtual.refresh()
      writeSize()
      if (options.following()) toEnd()
    },
    toEnd,
    /**
     * Scrolls from the keyboard: a line for the arrows, a page less a line for PageUp and PageDown, the start for
     * Home. Instant, and handled here: Chrome's smooth keyboard scroll keeps moving after a later scroll to the end,
     * which would take the view away again as soon as End or the jump button brought it back.
     */
    scrollByKey(key: string) {
      if (!scroller) return false
      const page = Math.max(rowHeight, scroller.clientHeight - rowHeight)
      const deltas: Record<string, number> = {
        ArrowUp: -rowHeight,
        ArrowDown: rowHeight,
        PageUp: -page,
        PageDown: page,
      }
      const end = scroller.scrollHeight - scroller.clientHeight
      const top = key === "Home" ? 0 : scroller.scrollTop + (deltas[key] ?? Number.NaN)
      if (Number.isNaN(top)) return false
      setTop(Math.max(0, Math.min(end, top)))
      options.setFollowing(end - scroller.scrollTop <= END_TOLERANCE)
      virtual.refresh()
      return true
    },
    /** Brings a line into view, centred. */
    reveal(position: number) {
      virtual.scrollToIndex(position, { align: "center" })
      ownScroll = scroller?.scrollTop
    },
    /** The first and last positions in view; -1 and the count when nothing is. */
    inView() {
      if (!scroller) return { first: -1, last: options.count() }
      const top = scroller.scrollTop
      const bottom = top + scroller.clientHeight
      const shown = virtual.items().filter((item) => item.start + item.size > top && item.start < bottom)
      return { first: shown[0]?.index ?? -1, last: shown.at(-1)?.index ?? options.count() }
    },
    /** The text a person selected inside the log, if any. */
    selectedText() {
      const selection = scroller?.ownerDocument.getSelection()
      if (!scroller || !selection || selection.isCollapsed) return undefined
      if (!scroller.contains(selection.anchorNode) || !scroller.contains(selection.focusNode)) return undefined
      return selection.toString()
    },
    connect(el: HTMLElement) {
      scroller = el
      const onScroll = () => {
        const top = el.scrollTop
        const own = ownScroll !== undefined && Math.abs(top - ownScroll) < 2
        ownScroll = undefined
        if (!own) options.setFollowing(el.scrollHeight - el.clientHeight - top <= END_TOLERANCE)
      }
      // While following, a viewport that grows or shrinks keeps the end in view.
      const resize =
        typeof ResizeObserver === "function"
          ? new ResizeObserver(() => {
              if (options.following()) toEnd()
            })
          : undefined
      resize?.observe(el)
      // Before the virtualizer's own listener: a scroll away from the end lets go before the rows it brings in
      // render, so nothing pulls the view back.
      el.addEventListener("scroll", onScroll, { passive: true })
      el.addEventListener("keydown", options.onKeyDown)
      const restore = layersBesideViewport(el)
      const disconnect = virtual.connect(el)
      let size = virtual.size()
      const stopSize = virtual.subscribe(() => {
        if (virtual.size() === size) return
        size = virtual.size()
        writeSize()
        if (options.following()) toEnd()
      })
      return () => {
        el.removeEventListener("scroll", onScroll)
        el.removeEventListener("keydown", options.onKeyDown)
        resize?.disconnect()
        stopSize()
        disconnect()
        restore()
        if (scroller === el) scroller = undefined
      }
    },
    /** Holds the element the rows sit in, sized to all of them. */
    bindRows(el: HTMLElement | null) {
      rows = el ?? undefined
      written = -1
      writeSize()
    },
    /** Takes the height of one unwrapped line from an element styled like a row, and follows it as it changes. */
    measureRow(el: HTMLElement | null) {
      if (!el || typeof ResizeObserver !== "function") return undefined
      const observer = new ResizeObserver(([entry]) => {
        const height = entry?.borderBoxSize?.[0]?.blockSize ?? el.getBoundingClientRect().height
        if (!height || Math.abs(height - rowHeight) < 0.01) return
        rowHeight = height
        virtual.reset()
        virtual.refresh()
        writeSize()
        if (options.following()) toEnd()
      })
      observer.observe(el)
      return () => observer.disconnect()
    },
  }
}

type LogScroller = ReturnType<typeof createLogScroller>

export { createLogScroller }
export type { LogScroller }
