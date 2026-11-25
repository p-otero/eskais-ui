import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Popover, PopoverClose, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"

function PopoverCheck() {
  const [open, setOpen] = useState(false)
  return (
    <main className="flex flex-col items-start gap-section p-section">
      <Popover openOnHover delay={150} closeDelay={150}>
        <PopoverTrigger>Hover for criteria</PopoverTrigger>
        <PopoverContent side="bottom">
          <PopoverTitle>Hover criteria</PopoverTitle>
          <PopoverClose>Close criteria</PopoverClose>
        </PopoverContent>
      </Popover>
      <p>Somewhere else on the page</p>
      <Button onClick={() => setOpen(true)}>Open task</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent initialFocus="content">
          <DialogTitle>Task with an open popover</DialogTitle>
          <Popover defaultOpen>
            <PopoverTrigger>Acceptance 2/3</PopoverTrigger>
            <PopoverContent>
              <PopoverTitle>Acceptance criteria</PopoverTitle>
              <PopoverClose>Done</PopoverClose>
            </PopoverContent>
          </Popover>
          <Button variant="outline">After the popover</Button>
        </DialogContent>
      </Dialog>
    </main>
  )
}

export { PopoverCheck }
