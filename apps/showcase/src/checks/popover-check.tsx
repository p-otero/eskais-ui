import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Popover, PopoverClose, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"

// ?demo=popover-check: a popover open from the start inside a dialog, for tooling/popover-check.mjs.
function PopoverCheck() {
  const [open, setOpen] = useState(false)
  return (
    <main className="flex flex-col items-start gap-section p-section">
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
