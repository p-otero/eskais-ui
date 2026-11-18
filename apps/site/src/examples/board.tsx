import type { TransferLists } from "@ui-sdk/core"
import { useState } from "react"

import { Board, BoardItem, BoardItemHandle, BoardColumn } from "@/components/ui/board"
import { Button } from "@/components/ui/button"
import { CardDescription, CardTitle } from "@/components/ui/card"
import { EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"

const stories: Record<string, { title: string; note: string }> = {
  i1: { title: "A field guide to city birds", note: "Pitched by the photo desk" },
  i2: { title: "Night markets after the rain", note: "Needs a photographer" },
  d1: { title: "Rooftop gardens, one year on", note: "Outline approved" },
}
const columns: Record<string, string> = { ideas: "Ideas", drafting: "Drafting", editing: "Editing" }

export default function BoardDemo() {
  const [lists, setLists] = useState<TransferLists>({ ideas: ["i1", "i2"], drafting: ["d1"], editing: [] })
  return (
    <Board
      aria-label="Editorial calendar"
      className="w-full"
      value={lists}
      onValueChange={setLists}
      handle
      itemLabel={(id) => stories[id]?.title}
      listLabel={(list) => columns[list]}
    >
      {Object.keys(columns).map((list) => (
        <BoardColumn
          key={list}
          value={list}
          title={columns[list] ?? list}
          actions={
            list === "ideas" ? (
              <Button size="sm" variant="ghost">
                Add idea
              </Button>
            ) : undefined
          }
          empty={
            <EmptyHeader>
              <EmptyTitle render={<p>Nothing here</p>} />
              <EmptyDescription>Drag a story here, or press Space on its handle and use the arrows.</EmptyDescription>
            </EmptyHeader>
          }
        >
          {(ids) =>
            ids.map((id) => (
              <BoardItem key={id} value={id}>
                <BoardItemHandle label={stories[id]?.title} />
                <div className="flex min-w-0 flex-col gap-inline">
                  <CardTitle render={<p>{stories[id]?.title}</p>} />
                  <CardDescription>{stories[id]?.note}</CardDescription>
                </div>
              </BoardItem>
            ))
          }
        </BoardColumn>
      ))}
    </Board>
  )
}
