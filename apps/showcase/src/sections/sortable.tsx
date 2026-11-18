import type { TransferLists } from "@ui-sdk/core"
import { useState } from "react"

import { Board, BoardItem, BoardItemHandle, BoardColumn } from "@/components/ui/board"
import { Button } from "@/components/ui/button"
import { List, ListItem } from "@/components/ui/list-item"
import { Sortable, SortableHandle, SortableItem } from "@/components/ui/sortable"

import { Section } from "../section"

const LAYERS: Record<string, string> = {
  headline: "Sale headline",
  shot: "Product shot",
  badge: "Price badge",
  fill: "Gradient fill",
}

const SWATCHES = ["terracotta", "sand", "olive", "pine", "lagoon", "denim", "charcoal", "blush"]

const TRACKS = Array.from({ length: 24 }, (_, index) => `Track ${String(index + 1).padStart(2, "0")}`)

type Step = { id: string; title: string }
const STEPS: Step[] = [
  { id: "brief", title: "Write the brief" },
  { id: "draft", title: "Draft the copy" },
  { id: "review", title: "Review with legal" },
  { id: "ship", title: "Ship the campaign" },
]

const CARDS: Record<string, string> = {
  icons: "Export app icons",
  kerning: "Fix nav kerning",
  legend: "Map legend colors",
  onboarding: "Onboarding flow v3",
  invoices: "Invoice PDF layout",
}
const COLUMNS: Record<string, string> = { backlog: "Backlog", week: "This week", done: "Done" }

function Layers() {
  const [order, setOrder] = useState(Object.keys(LAYERS))
  return (
    <div className="flex w-64 flex-col gap-items">
      <Sortable aria-label="Poster layers" value={order} onValueChange={setOrder} itemLabel={(key) => LAYERS[key]}>
        {({ order: shown }) =>
          shown.map((key) => (
            <SortableItem key={key} value={key}>
              {LAYERS[key]}
            </SortableItem>
          ))
        }
      </Sortable>
      <p className="text-caption text-muted-foreground">{order.map((key) => LAYERS[key]).join(" · ")}</p>
    </div>
  )
}

function Palette() {
  const [selected, setSelected] = useState(["olive", "lagoon"])
  return (
    <Sortable
      aria-label="Brand palette"
      orientation="grid"
      defaultValue={SWATCHES}
      selected={selected}
      onSelectedChange={setSelected}
      className="w-96"
    >
      {({ order: shown }) =>
        shown.map((key) => (
          <SortableItem key={key} value={key}>
            {key}
          </SortableItem>
        ))
      }
    </Sortable>
  )
}

function Playlist() {
  const [order, setOrder] = useState(TRACKS)
  return (
    <div className="h-64 w-64 overflow-auto rounded-surface border">
      <Sortable aria-label="Playlist" handle preview variant="row" value={order} onValueChange={setOrder}>
        {({ order: shown }) =>
          shown.map((track) => (
            <SortableItem key={track} value={track}>
              <SortableHandle label={track} />
              <span className="flex-1">{track}</span>
              <Button size="sm" variant="ghost">
                Play {track}
              </Button>
            </SortableItem>
          ))
        }
      </Sortable>
    </div>
  )
}

function Steps() {
  const [steps, setSteps] = useState(STEPS)
  const [checked, setChecked] = useState<string[]>([])
  return (
    <div className="w-80">
      <List
        aria-label="Campaign steps"
        items={steps}
        sortable
        onReorder={(ids) => setSteps(ids.flatMap((id) => steps.filter((step) => step.id === id)))}
        checkedIds={checked}
        onCheckedIdsChange={setChecked}
        renderItem={(step) => <ListItem id={step.id} title={step.title} onSelect={() => {}} />}
      />
    </div>
  )
}

function Sprint() {
  const [lists, setLists] = useState<TransferLists>({
    backlog: ["icons", "legend", "onboarding"],
    week: ["kerning", "invoices"],
    done: [],
  })
  return (
    <Board
      aria-label="Design sprint"
      value={lists}
      onValueChange={setLists}
      handle
      accepts={(key, list) => list !== "week" || (lists.week?.filter((card) => card !== key).length ?? 0) < 3}
      itemLabel={(key) => CARDS[key]}
      listLabel={(list) => COLUMNS[list]}
    >
      {Object.keys(COLUMNS).map((list) => (
        <BoardColumn key={list} value={list} title={COLUMNS[list] ?? list} empty="Drop a card here">
          {(ids) =>
            ids.map((id) => (
              <BoardItem key={id} value={id}>
                <BoardItemHandle label={CARDS[id]} />
                {CARDS[id]}
              </BoardItem>
            ))
          }
        </BoardColumn>
      ))}
    </Board>
  )
}

function SortableSection() {
  return (
    <Section
      title="Sortable"
      description="Reorder by drag, by keyboard (Space lifts, arrows move, Space drops, Escape cancels) and by agents: a list, a grid where checked swatches move together (Ctrl or Cmd and Space or a click), a scrolling playlist with handles and a dragged copy, a List with onReorder, and a board whose cards move between columns (This week takes three)."
    >
      <div className="flex w-full flex-col gap-section">
        <div className="flex flex-wrap items-start gap-section">
          <Layers />
          <Palette />
          <Playlist />
          <Steps />
        </div>
        <Sprint />
      </div>
    </Section>
  )
}

export { Layers, Playlist, SortableSection, Sprint }
