import { useState } from "react"

import {
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  createDialogController,
} from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ShortcutsDialog, ShortcutsDialogTrigger } from "@/components/ui/shortcuts-dialog"
import { Textarea } from "@/components/ui/textarea"

const filler = Array.from({ length: 8 }, (_, index) => `Line ${index + 1} of the notes kept with this file.`)

function DialogMobileCheck() {
  const [rename] = useState(() => createDialogController())
  return (
    <main className="flex flex-col gap-section p-inset-surface">
      <div className="flex flex-wrap gap-items">
        <DropdownMenu>
          <DropdownMenuTrigger aria-label="File actions">Actions</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={() => rename.open()}>Rename file</DropdownMenuItem>
            <DropdownMenuItem>Duplicate</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ShortcutsDialog>
          <ShortcutsDialogTrigger variant="ghost">Keyboard shortcuts</ShortcutsDialogTrigger>
        </ShortcutsDialog>
      </div>
      <Dialog controller={rename}>
        <DialogBackdrop />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename file</DialogTitle>
            <DialogDescription>Names must be unique in a folder.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Field>
              <FieldLabel>Name</FieldLabel>
              <Input defaultValue="report.pdf" />
            </Field>
            {filler.map((line) => (
              <p key={line} className="text-body-sm text-muted-foreground">
                {line}
              </p>
            ))}
            <Field>
              <FieldLabel>Notes</FieldLabel>
              <Textarea />
            </Field>
          </DialogBody>
          <DialogFooter>
            <DialogClose>Cancel</DialogClose>
            <DialogClose variant="default" value="rename">
              Rename
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div aria-hidden="true" className="h-750" />
    </main>
  )
}

export { DialogMobileCheck }
