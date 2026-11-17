/** How many items, in order, fit in `available` with the gap between them, leaving room for a More trigger. */
function fitCount(widths: readonly number[], moreWidth: number, gap: number, available: number) {
  const total = widths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, widths.length - 1)
  if (total <= available) return widths.length
  let used = moreWidth
  let count = 0
  for (const width of widths) {
    if (used + gap + width > available) break
    used += gap + width
    count++
  }
  return count
}

function widthOf(element: Element | null) {
  return element?.getBoundingClientRect().width ?? 0
}

export { fitCount, widthOf }
