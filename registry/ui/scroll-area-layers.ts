/**
 * UI SDK's virtualizer puts its findable layers, a stand-in for every row, at the start and end of the element it
 * scrolls. A ScrollArea viewport reads every focusable element below it again whenever a tabindex below it changes,
 * which a roving tree or grid does on every arrow key, so the layers go in the scroll area's root beside the viewport
 * instead: 8 ms a key press on 50,000 commits at 4× CPU. They are absolutely positioned against the root either way.
 */
function layersBesideViewport(scroller: HTMLElement) {
  const root = scroller.parentElement
  if (root?.dataset.slot !== "scroll-area") return () => {}
  scroller.prepend = (...nodes) => root.prepend(...nodes)
  scroller.append = (...nodes) => root.append(...nodes)
  return () => {
    Reflect.deleteProperty(scroller, "prepend")
    Reflect.deleteProperty(scroller, "append")
  }
}

export { layersBesideViewport }
