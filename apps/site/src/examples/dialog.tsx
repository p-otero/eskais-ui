import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export default function DialogDemo() {
  return (
    <Dialog>
      <DialogTrigger>Rename project</DialogTrigger>
      <DialogBackdrop />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Apollo</DialogTitle>
          <DialogDescription>Everyone on the team sees the new name.</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel>Project name</FieldLabel>
          <Input defaultValue="Apollo" />
        </Field>
        <DialogFooter>
          <DialogClose>Cancel</DialogClose>
          <DialogClose variant="default" value="save">
            Save
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
