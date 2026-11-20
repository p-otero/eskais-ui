import { Children, isValidElement, type KeyboardEvent, type ReactElement, type ReactNode } from "react"

function defaultText(item: unknown) {
  if (typeof item === "string") return item
  if (typeof item === "object" && item !== null) {
    const record = item as Record<string, unknown>
    for (const key of ["title", "label", "name", "id"]) if (typeof record[key] === "string") return record[key]
  }
  return ""
}

type ChildRow = ReactElement<{ id: string; title?: unknown }>

// Flat rows given as children, each with a string `id` (`<ListItem id>`), are the list's data too, so they
// virtualize like `items`. Anything else, like a ListGroup, keeps rendering as it is.
function childRowsOf(children: ReactNode): ChildRow[] | undefined {
  const all = Children.toArray(children)
  if (all.length === 0) return undefined
  const rows: ChildRow[] = []
  for (const child of all) {
    if (!isValidElement<{ id?: unknown }>(child) || typeof child.props.id !== "string") return undefined
    rows.push(child as ChildRow)
  }
  return rows
}

const childId = (row: unknown) => (row as ChildRow).props.id
const childText = (row: unknown) => {
  const { id, title } = (row as ChildRow).props
  return typeof title === "string" ? title : id
}
const renderChild = (row: unknown) => row as ChildRow

function defaultId(item: unknown) {
  if (typeof item === "object" && item !== null && "id" in item) return String((item as { id: unknown }).id)
  return String(item)
}

const listboxKeys: Record<string, string> = { j: "ArrowDown", k: "ArrowUp" }

// The listbox moves with arrows; j and k are the same moves, and the page keys jump by a screen of options.
function listboxKeyDown(event: KeyboardEvent<HTMLElement>, setValue: (id: string) => void) {
  if (event.altKey || event.ctrlKey || event.metaKey || !(event.target instanceof HTMLElement)) return
  const option = event.target.closest<HTMLElement>('[role="option"]')
  if (!option) return
  const arrow = listboxKeys[event.key]
  if (arrow) {
    event.preventDefault()
    event.stopPropagation()
    option.dispatchEvent(new globalThis.KeyboardEvent("keydown", { key: arrow, bubbles: true, cancelable: true }))
    return
  }
  if (event.key !== "PageDown" && event.key !== "PageUp") return
  const options = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="option"]')]
  const viewport = event.currentTarget.closest<HTMLElement>("[data-slot=list]")?.parentElement?.clientHeight ?? 0
  const page = Math.max(1, Math.floor(viewport / Math.max(1, option.offsetHeight)) - 1)
  const from = options.indexOf(option)
  const target = options[Math.min(options.length - 1, Math.max(0, from + (event.key === "PageDown" ? page : -page)))]
  const id = target?.dataset.itemId
  if (!target || id === undefined) return
  event.preventDefault()
  target.scrollIntoView({ block: "nearest" })
  target.focus()
  setValue(id)
}

export { childId, childRowsOf, childText, defaultId, defaultText, listboxKeyDown, renderChild }
