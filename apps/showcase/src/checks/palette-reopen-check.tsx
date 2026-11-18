import { useState } from "react"

import { Command, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import {
  CommandDialog,
  CommandDialogContent,
  CommandDialogShortcut,
  CommandDialogTrigger,
  createCommandDialogController,
} from "@/components/ui/command-dialog"

// ?demo=palette-reopen-check: a palette whose content stays mounted while closed, as some Electron windows leave it,
// for tooling/shell-check.mjs to open, run a command and reopen with Ctrl+K.
function PaletteReopenCheck() {
  const [controller] = useState(() => createCommandDialogController())
  const [ran, setRan] = useState("")
  return (
    <main className="flex flex-col items-start gap-items p-inset-surface">
      <CommandDialog controller={controller}>
        <CommandDialogTrigger shortcut="mod+k">
          Open palette
          <CommandDialogShortcut />
        </CommandDialogTrigger>
        <CommandDialogContent title="Palette" keepMounted>
          <Command
            onAction={(value) => {
              setRan(value)
              controller.close()
            }}
          >
            <CommandInput aria-label="Find a command" />
            <CommandList>
              <CommandItem value="apollo">Apollo</CommandItem>
              <CommandItem value="atlas">Atlas</CommandItem>
              <CommandItem value="lab">Lab notes</CommandItem>
            </CommandList>
          </Command>
        </CommandDialogContent>
      </CommandDialog>
      <output aria-label="Last command">{ran}</output>
    </main>
  )
}

export { PaletteReopenCheck }
