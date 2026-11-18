import { useState } from "react"

import { Sortable, SortableItem } from "@/components/ui/sortable"

import { Layers, Playlist, Sprint } from "../sections/sortable"

declare global {
  var sortableRenders: number | undefined
}

const FRUITS = ["Apple", "Banana", "Cherry", "Damson"]

// Counts its renders, so tooling/sortable-check.mjs can tell a pointer move from a re-render.
function Counted({ name }: { name: string }) {
  // oxlint-disable-next-line react/immutability -- the render count is what the check measures
  globalThis.sortableRenders = (globalThis.sortableRenders ?? 0) + 1
  return <span>{name}</span>
}

function Fruits() {
  const [order, setOrder] = useState(FRUITS)
  return (
    <div className="flex w-64 flex-col gap-items">
      <Sortable aria-label="Fruits" value={order} onValueChange={setOrder}>
        {({ order: shown }) =>
          shown.map((name) => (
            <SortableItem key={name} value={name}>
              <Counted name={name} />
            </SortableItem>
          ))
        }
      </Sortable>
      <output aria-label="Fruit order">{order.join(",")}</output>
    </div>
  )
}

// ?demo=sortable-check: the fixtures of tooling/sortable-check.mjs.
function SortableCheck() {
  return (
    <main className="flex flex-col gap-section p-section">
      <div className="flex flex-wrap items-start gap-section">
        <Fruits />
        <Layers />
        <Playlist />
      </div>
      <Sprint />
    </main>
  )
}

export { SortableCheck }
