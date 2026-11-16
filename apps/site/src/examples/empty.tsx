import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"

export default function EmptyDemo() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle render={<h3>No tasks yet</h3>} />
        <EmptyDescription>Tasks you or an agent create show up here.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button size="sm">Create task</Button>
      </EmptyContent>
    </Empty>
  )
}
