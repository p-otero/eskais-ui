import { Board, BoardColumn } from "@/components/ui/board"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"

const ideas = [
  { id: "i1", title: "A field guide to city birds", note: "Pitched by the photo desk" },
  { id: "i2", title: "Night markets after the rain", note: "Needs a photographer" },
]
const drafting = [{ id: "d1", title: "Rooftop gardens, one year on", note: "Outline approved" }]

function StoryCard({ title, note }: { title: string; note: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle render={<p>{title}</p>} />
        <CardDescription>{note}</CardDescription>
      </CardHeader>
    </Card>
  )
}

export default function BoardDemo() {
  return (
    <Board aria-label="Editorial calendar" className="w-full">
      <BoardColumn
        title="Ideas"
        count={ideas.length}
        actions={
          <Button size="sm" variant="ghost">
            Add idea
          </Button>
        }
      >
        {ideas.map((story) => (
          <StoryCard key={story.id} title={story.title} note={story.note} />
        ))}
      </BoardColumn>
      <BoardColumn title="Drafting" count={drafting.length}>
        {drafting.map((story) => (
          <StoryCard key={story.id} title={story.title} note={story.note} />
        ))}
      </BoardColumn>
      <BoardColumn
        title="Editing"
        count={0}
        empty={
          <EmptyHeader>
            <EmptyTitle render={<p>Nothing to edit</p>} />
            <EmptyDescription>Drafts move here when they are ready.</EmptyDescription>
          </EmptyHeader>
        }
      />
    </Board>
  )
}
