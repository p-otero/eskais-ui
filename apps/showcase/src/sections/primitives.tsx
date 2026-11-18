import { useState } from "react"
import { Trash2Icon } from "lucide-react"

import { ConfirmButton } from "@/components/ui/confirm-button"
import { InlineEdit } from "@/components/ui/inline-edit"

import { Section } from "../section"

const notEmpty = (text: string) => text.trim() !== ""

function PrimitivesSection() {
  const [confirmed, setConfirmed] = useState<string[]>([])
  const log = (what: string) => setConfirmed((list) => [what, ...list].slice(0, 3))
  return (
    <Section
      title="In place"
      description="Primitives built with definePrimitive: rename in place, and a button that asks twice (or holds), with data-agent-confirm."
    >
      <div data-primitives-demo className="flex w-full flex-col gap-group">
        <div className="flex flex-col gap-items">
          <InlineEdit
            label="Workspace name"
            defaultValue="Northwind"
            validate={notEmpty}
            size="title-sm"
            onValueChange={(name) => log(`Renamed to ${name}`)}
          />
          <ul className="flex flex-col gap-inline">
            {["Morning pages", "Commute", "Rainy Sunday"].map((name) => (
              <li key={name}>
                <InlineEdit
                  label="Playlist name"
                  defaultValue={name}
                  validate={notEmpty}
                  startOn="double-click"
                  blur="cancel"
                  editButton={false}
                />
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-wrap items-center gap-items">
          <ConfirmButton agentConfirm="Deletes the draft" onConfirm={() => log("Deleted the draft")}>
            <Trash2Icon />
            Delete draft
          </ConfirmButton>
          <ConfirmButton
            variant="outline"
            hold={900}
            agentConfirm="Archives every finished task"
            onConfirm={() => log("Archived finished tasks")}
          >
            Archive finished
          </ConfirmButton>
        </div>
        <p className="text-body-sm text-muted-foreground" aria-live="polite">
          {confirmed.length === 0 ? "Press twice, or hold the second button." : confirmed.join(", ")}
        </p>
      </div>
    </Section>
  )
}

export { PrimitivesSection }
