import { Board, BoardColumn, BoardColumnGroup } from "@/components/ui/board"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"

import { Section } from "../section"

type Story = { id: string; title: string; note: string }

const ideas: Story[] = [
  { id: "i1", title: "A field guide to city birds", note: "Pitched by the photo desk" },
  { id: "i2", title: "Night markets after the rain", note: "Needs a photographer" },
  { id: "i3", title: "The last letterpress in town", note: "Interview requested" },
]
const ready: Story[] = [
  { id: "d1", title: "Rooftop gardens, one year on", note: "Outline approved" },
  { id: "d2", title: "Ferry timetables, explained", note: "Charts attached" },
]
const waiting: Story[] = [{ id: "d3", title: "Inside the seed library", note: "Waiting on the archive scans" }]
const published: Story[] = [
  { id: "p1", title: "A week without a car", note: "Ran on Monday" },
  { id: "p2", title: "Winter soups from five kitchens", note: "Ran on Friday" },
]

function StoryCard({ story }: { story: Story }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle render={<p>{story.title}</p>} />
        <CardDescription>{story.note}</CardDescription>
      </CardHeader>
    </Card>
  )
}

function BoardSection() {
  return (
    <Section
      title="Board"
      description="A horizontally scrolling list of columns: counts, actions, groups, an empty slot and collapsible columns."
    >
      <Board aria-label="Editorial calendar">
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
            <StoryCard key={story.id} story={story} />
          ))}
        </BoardColumn>
        <BoardColumn title="Drafting" count={ready.length + waiting.length} defaultCollapsed={false}>
          <BoardColumnGroup title="Ready" count={ready.length}>
            {ready.map((story) => (
              <StoryCard key={story.id} story={story} />
            ))}
          </BoardColumnGroup>
          <BoardColumnGroup title="Waiting on a dependency" count={waiting.length}>
            {waiting.map((story) => (
              <StoryCard key={story.id} story={story} />
            ))}
          </BoardColumnGroup>
        </BoardColumn>
        <BoardColumn
          title="Editing"
          count={0}
          empty={
            <EmptyHeader>
              <EmptyTitle render={<p>Nothing to edit</p>} />
              <EmptyDescription>Drafts move here when they are ready for an editor.</EmptyDescription>
            </EmptyHeader>
          }
        />
        <BoardColumn title="Published" count={published.length} defaultCollapsed>
          {published.map((story) => (
            <StoryCard key={story.id} story={story} />
          ))}
        </BoardColumn>
      </Board>
    </Section>
  )
}

export { BoardSection }
// Beside the board it moves cards on, and off app.tsx, which sits at its line limit.
export { SortableSection } from "./sortable"
