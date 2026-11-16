import {
  Drawer,
  DrawerBackdrop,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHandle,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"

function TaskDrawer({ side, label }: { side: "right" | "bottom"; label: string }) {
  return (
    <Drawer side={side}>
      <DrawerTrigger>{label}</DrawerTrigger>
      <DrawerBackdrop />
      <DrawerContent>
        {side === "bottom" && <DrawerHandle />}
        <DrawerHeader>
          <DrawerTitle>Index the docs</DrawerTitle>
          <DrawerDescription>Queued by the planner, attempt 2 of 3.</DrawerDescription>
        </DrawerHeader>
        <p className="text-body">The first attempt hit a rate limit after 1,204 of 3,310 pages.</p>
        <DrawerFooter>
          <DrawerClose>Close task</DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

export default function DrawerDemo() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-items">
      <TaskDrawer side="right" label="Open task panel" />
      <TaskDrawer side="bottom" label="Open task sheet" />
    </div>
  )
}
