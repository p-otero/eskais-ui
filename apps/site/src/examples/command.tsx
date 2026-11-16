import { useState } from "react"

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import {
  CommandDialog,
  CommandDialogContent,
  CommandDialogShortcut,
  CommandDialogTrigger,
} from "@/components/ui/command-dialog"
import { toast } from "@/components/ui/toast"

export default function CommandDemo() {
  const [open, setOpen] = useState(false)
  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandDialogTrigger shortcut="mod+j">
        Run a command
        <CommandDialogShortcut />
      </CommandDialogTrigger>
      <CommandDialogContent>
        <Command
          onAction={(value) => {
            toast.success(`Ran ${value}`)
            setOpen(false)
          }}
        >
          <CommandInput aria-label="Run a command" placeholder="Type a command or search" />
          <CommandEmpty>No commands found.</CommandEmpty>
          <CommandList>
            <CommandGroup>
              <CommandGroupLabel>Tasks</CommandGroupLabel>
              <CommandItem value="new task">New task</CommandItem>
              <CommandItem value="retry failed">Retry failed tasks</CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <CommandGroupLabel>Go to</CommandGroupLabel>
              <CommandItem value="open board" shortcut="mod+shift+b">
                Open board
                <CommandShortcut />
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialogContent>
    </CommandDialog>
  )
}
