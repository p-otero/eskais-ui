import { Tabs, TabsIndicator, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs"

export default function TabsDemo() {
  return (
    <Tabs defaultValue="board" className="flex w-full max-w-md flex-col gap-items">
      <TabsList aria-label="Task view" className="w-fit">
        <TabsIndicator />
        <TabsTab value="board">Board</TabsTab>
        <TabsTab value="table">Table</TabsTab>
        <TabsTab value="timeline">Timeline</TabsTab>
      </TabsList>
      <TabsPanel value="board" className="text-body-sm text-muted-foreground">
        Columns of tasks by status.
      </TabsPanel>
      <TabsPanel value="table" className="text-body-sm text-muted-foreground">
        A sortable table of every task.
      </TabsPanel>
      <TabsPanel value="timeline" className="text-body-sm text-muted-foreground">
        Attempts over time.
      </TabsPanel>
    </Tabs>
  )
}
