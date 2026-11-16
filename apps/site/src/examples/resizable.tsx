import { Resizable, ResizableHandle, ResizablePanel } from "@/components/ui/resizable"

export default function ResizableDemo() {
  return (
    <div className="h-48 w-full overflow-hidden rounded-surface border bg-background">
      <Resizable>
        <ResizablePanel defaultSize={30} minSize={20} collapsible>
          <div className="p-inset-surface text-body-sm">Files</div>
        </ResizablePanel>
        <ResizableHandle aria-label="Resize files" withGrip />
        <ResizablePanel>
          <div className="p-inset-surface text-body-sm">Editor</div>
        </ResizablePanel>
      </Resizable>
    </div>
  )
}
