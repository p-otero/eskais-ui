import { createVirtualizer } from "@ui-sdk/core"

import { layersBesideViewport } from "@/components/ui/scroll-area-layers"

const AT_END_TOLERANCE_PX = 4

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
  let scrollTopSetHere: number | undefined

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
    scrollTopSetHere = scroller.scrollTop
  }

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
    refresh(removedAbove = 0, averageRow = rowHeight) {
      virtual.refresh()
      writeSize()
      if (!scroller) return
      if (options.following()) toEnd()
      else if (removedAbove > 0) {
        const keepTextUnderReader = scroller.scrollTop - removedAbove * averageRow
        setTop(Math.max(0, keepTextUnderReader))
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
    // Workaround: Chrome's smooth keyboard scroll keeps moving after a later scroll to the end, so keys scroll
    // instantly here.
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
      options.setFollowing(end - scroller.scrollTop <= AT_END_TOLERANCE_PX)
      virtual.refresh()
      return true
    },
    reveal(position: number) {
      virtual.scrollToIndex(position, { align: "center" })
      scrollTopSetHere = scroller?.scrollTop
    },
    inView() {
      if (!scroller) return { first: -1, last: options.count() }
      const top = scroller.scrollTop
      const bottom = top + scroller.clientHeight
      const shown = virtual.items().filter((item) => item.start + item.size > top && item.start < bottom)
      return { first: shown[0]?.index ?? -1, last: shown.at(-1)?.index ?? options.count() }
    },
    selectedText() {
      const selection = scroller?.ownerDocument.getSelection()
      if (!scroller || !selection || selection.isCollapsed) return undefined
      if (!scroller.contains(selection.anchorNode) || !scroller.contains(selection.focusNode)) return undefined
      return selection.toString()
    },
    connect(el: HTMLElement) {
      scroller = el
      const onScrollBeforeVirtualizer = () => {
        const top = el.scrollTop
        const scrolledHere = scrollTopSetHere !== undefined && Math.abs(top - scrollTopSetHere) < 2
        scrollTopSetHere = undefined
        if (!scrolledHere) options.setFollowing(el.scrollHeight - el.clientHeight - top <= AT_END_TOLERANCE_PX)
      }
      const followEndOnResize =
        typeof ResizeObserver === "function"
          ? new ResizeObserver(() => {
              if (options.following()) toEnd()
            })
          : undefined
      followEndOnResize?.observe(el)
      el.addEventListener("scroll", onScrollBeforeVirtualizer, { passive: true })
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
        el.removeEventListener("scroll", onScrollBeforeVirtualizer)
        el.removeEventListener("keydown", options.onKeyDown)
        followEndOnResize?.disconnect()
        stopSize()
        disconnect()
        restore()
        if (scroller === el) scroller = undefined
      }
    },
    bindRows(el: HTMLElement | null) {
      rows = el ?? undefined
      written = -1
      writeSize()
    },
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
