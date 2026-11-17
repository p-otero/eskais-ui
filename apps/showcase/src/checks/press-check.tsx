import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@/components/ui/segmented-control"
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs"

// ?demo=press-check: tabs and segmented controls with and without activateOnPress, for tooling/press-check.mjs.
function PressCheck() {
  return (
    <main className="flex flex-col gap-section p-section">
      {[true, false].map((onPress) => (
        <div key={String(onPress)} className="flex flex-col gap-group">
          <Tabs defaultValue="account" activateOnPress={onPress}>
            <TabsList aria-label={onPress ? "Tabs on press" : "Tabs on release"}>
              <TabsTab value="account">Account</TabsTab>
              <TabsTab value="password">Password</TabsTab>
            </TabsList>
            <TabsPanel value="account">Profile settings</TabsPanel>
            <TabsPanel value="password">Password settings</TabsPanel>
          </Tabs>
          <SegmentedControl
            aria-label={onPress ? "View on press" : "View on release"}
            defaultValue="board"
            activateOnPress={onPress}
          >
            <SegmentedControlIndicator />
            <SegmentedControlItem value="board">Board</SegmentedControlItem>
            <SegmentedControlItem value="table">Table</SegmentedControlItem>
          </SegmentedControl>
        </div>
      ))}
    </main>
  )
}

export { PressCheck }
