import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Sortable, SortableHandle, SortableItem } from "@/components/ui/sortable"

const LAYERS: Record<string, string> = {
  headline: "Sale headline",
  shot: "Product shot",
  badge: "Price badge",
  fill: "Gradient fill",
}

const STEPS: Record<string, string> = {
  brief: "Write the brief",
  draft: "Draft the copy",
  review: "Review with legal",
  ship: "Ship the campaign",
}

export default function SortableDemo() {
  const [layers, setLayers] = useState(Object.keys(LAYERS))
  const [steps, setSteps] = useState(Object.keys(STEPS))
  const [opened, setOpened] = useState<string | null>(null)

  return (
    <div className="grid w-full gap-section sm:grid-cols-2">
      <div className="flex flex-col gap-items">
        <Sortable aria-label="Poster layers" value={layers} onValueChange={setLayers} itemLabel={(key) => LAYERS[key]}>
          {({ order }) =>
            order.map((key) => (
              <SortableItem key={key} value={key}>
                {LAYERS[key]}
              </SortableItem>
            ))
          }
        </Sortable>
        <p className="text-caption text-muted-foreground">Focus a layer, press Space, move it with the arrows.</p>
      </div>
      <div className="flex flex-col gap-items">
        <Sortable
          aria-label="Campaign steps"
          handle
          value={steps}
          onValueChange={setSteps}
          itemLabel={(key) => STEPS[key]}
          variant="row"
        >
          {({ order }) =>
            order.map((key) => (
              <SortableItem key={key} value={key}>
                <SortableHandle label={STEPS[key]} />
                <span className="flex-1">{STEPS[key]}</span>
                <Button size="sm" variant="ghost" onClick={() => setOpened(key)}>
                  Open
                </Button>
              </SortableItem>
            ))
          }
        </Sortable>
        <p className="text-caption text-muted-foreground" aria-live="polite">
          {opened ? `Opened ${STEPS[opened] ?? opened}.` : "Drag by the handle; Open stays a button."}
        </p>
      </div>
    </div>
  )
}
