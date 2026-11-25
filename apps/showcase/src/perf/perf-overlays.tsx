import { useState } from "react"

import {
  Combobox,
  ComboboxContent,
  ComboboxControl,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandList,
  CommandRows,
  type CommandData,
} from "@/components/ui/command"
import { CommandDialog, CommandDialogContent, CommandDialogTrigger } from "@/components/ui/command-dialog"
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
import { Drawer, DrawerBackdrop, DrawerClose, DrawerContent, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { MarkdownEditor } from "@/components/ui/markdown-editor"
import { Popover, PopoverContent, PopoverDescription, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"

const verbs = ["Open", "Create", "Assign", "Archive", "Retry", "Move", "Rename", "Share", "Duplicate", "Export"]
const nouns = ["issue", "project", "cycle", "label", "view", "document", "team", "member", "milestone", "board"]
const commands = verbs.flatMap((verb) =>
  nouns.flatMap((noun) => [1, 2, 3].map((n) => ({ value: `${verb} ${noun} ${String(n)}`.toLowerCase(), verb }))),
)

const paletteData: CommandData = verbs.map((verb) => ({
  type: "group",
  label: verb,
  items: commands.filter((command) => command.verb === verb).map(({ value }) => ({ value, label: value })),
}))

function PaletteItems() {
  return (
    <>
      <CommandInput aria-label="Run a command" placeholder="Type a command or search" />
      <CommandEmpty>No commands found.</CommandEmpty>
      <CommandList>{(state) => <CommandRows items={state.items} />}</CommandList>
    </>
  )
}

function CommandScenario() {
  return (
    <Command className="max-w-xl" items={paletteData} onAction={() => {}}>
      <PaletteItems />
    </Command>
  )
}

const menuItems = Array.from({ length: 24 }, (_, index) => `Action ${String(index + 1)}`)

function MenuScenario() {
  return (
    <DropdownMenu onAction={() => {}}>
      <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
      <DropdownMenuContent>
        {menuItems.map((item) => (
          <DropdownMenuItem key={item} value={item}>
            {item}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Paragraphs() {
  return (
    <div className="flex flex-col gap-items">
      {Array.from({ length: 6 }, (_, index) => (
        <p key={index}>
          Paragraph {index + 1}: the first attempt hit a rate limit after 1,204 of 3,310 pages, and the retry resumed
          from the last checkpoint.
        </p>
      ))}
    </div>
  )
}

function OverlaysScenario() {
  const [paletteOpen, setPaletteOpen] = useState(false)
  return (
    <div className="flex flex-wrap gap-items">
      <Dialog>
        <DialogTrigger>Open dialog</DialogTrigger>
        <DialogBackdrop />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Benchmark dialog</DialogTitle>
            <DialogDescription>Queued by the planner, attempt 2 of 3.</DialogDescription>
          </DialogHeader>
          <Paragraphs />
          <DialogFooter>
            <DialogClose>Close dialog</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Popover>
        <PopoverTrigger>Open popover</PopoverTrigger>
        <PopoverContent>
          <PopoverTitle>Attempt 2</PopoverTitle>
          <PopoverDescription>Retried 30 seconds after a rate limit.</PopoverDescription>
        </PopoverContent>
      </Popover>
      <MenuScenario />
      <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen}>
        <CommandDialogTrigger>Open palette</CommandDialogTrigger>
        <CommandDialogContent>
          <Command items={paletteData} onAction={() => setPaletteOpen(false)}>
            <PaletteItems />
          </Command>
        </CommandDialogContent>
      </CommandDialog>
      <Drawer side="right">
        <DrawerTrigger>Open drawer</DrawerTrigger>
        <DrawerBackdrop />
        <DrawerContent>
          <DrawerTitle>Benchmark drawer</DrawerTitle>
          <Paragraphs />
          <DrawerClose>Close drawer</DrawerClose>
        </DrawerContent>
      </Drawer>
    </div>
  )
}

const people = Array.from({ length: 200 }, (_, index) => ({
  value: `person-${String(index)}`,
  label: `${["Maya", "Ilya", "Sofia", "Kenji", "Amara"][index % 5] ?? ""} ${String(index)}`,
}))

const note = Array.from(
  { length: 40 },
  (_, index) => `## Section ${String(index + 1)}\n\nSome **bold** text, a [[wikilink]] and \`code\`.\n`,
).join("\n")

function TypingScenario() {
  return (
    <div className="flex w-full max-w-xl flex-col gap-group">
      <Input aria-label="Plain input" />
      <Combobox items={people}>
        <ComboboxControl>
          <ComboboxInput aria-label="Owner" placeholder="Owner" />
        </ComboboxControl>
        <ComboboxContent>
          <ComboboxEmpty>No one matches.</ComboboxEmpty>
          <ComboboxList>
            {(state) =>
              (state.items as typeof people).map((person) => (
                <ComboboxItem key={person.value} value={person.value}>
                  {person.label}
                </ComboboxItem>
              ))
            }
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <MarkdownEditor label="Benchmark note" defaultValue={note} className="h-96" />
    </div>
  )
}

export { CommandScenario, MenuScenario, OverlaysScenario, TypingScenario }
