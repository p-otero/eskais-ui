import { useState } from "react"

type Stored = Record<string, boolean>

function read(key: string): Stored {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "{}")
    return typeof value === "object" && value !== null ? (value as Stored) : {}
  } catch {
    return {}
  }
}

/**
 * Which docs sidebar sections are open. The current page's section opens whenever the reader arrives in it, and can
 * still be closed; every other section keeps what the reader last chose, remembered under `key`, and starts closed
 * except for `defaultOpen`.
 */
function useOpenSections(key: string, current: string | undefined, defaultOpen: string | undefined) {
  const [stored, setStored] = useState(() => read(key))
  const [closedHere, setClosedHere] = useState(false)
  const [seen, setSeen] = useState(current)
  if (seen !== current) {
    setSeen(current)
    setClosedHere(false)
  }

  const isOpen = (name: string) => (name === current ? !closedHere : (stored[name] ?? name === defaultOpen))
  const setOpen = (name: string, open: boolean) => {
    if (name === current) setClosedHere(!open)
    const next = { ...stored, [name]: open }
    setStored(next)
    try {
      localStorage.setItem(key, JSON.stringify(next))
    } catch {
      // Spec: Web Storage throws when full or blocked; the sections still open and close for this visit.
    }
  }
  return { isOpen, setOpen }
}

export { useOpenSections }
