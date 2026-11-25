import { createElement } from "react"
import {
  ArchiveIcon,
  BoldIcon,
  EllipsisIcon,
  CopyIcon,
  ExternalLinkIcon,
  ItalicIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogBackdrop, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ShortcutScope } from "@/components/ui/shortcuts"
import { Toggle } from "@/components/ui/toggle"

export function IconTooltipCheck() {
  return (
    <ShortcutScope name="icon-tooltip-check" active>
      <main className="flex min-h-dvh flex-col items-start gap-section bg-background p-section pt-24 text-foreground">
        <div
          data-testid="toolbar"
          className="flex items-center gap-inline rounded-surface border bg-card p-control-inset"
        >
          <Toggle size="icon" aria-label="Bold">
            <BoldIcon />
          </Toggle>
          <Toggle size="icon" aria-label="Italic">
            <ItalicIcon />
          </Toggle>
          <Button variant="ghost" size="icon" aria-label="Copy link" shortcut="mod+shift+c">
            <CopyIcon />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Archive">
            <ArchiveIcon />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Delete" tooltip="Moves the draft to the trash">
            <Trash2Icon />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open preview"
            render={createElement("a", { href: "#preview" })}
          >
            <ExternalLinkIcon />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger variant="ghost" size="icon" aria-label="More actions">
              <EllipsisIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Duplicate</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-inline">
          <span>Close the banner</span>
          <Button variant="outline" size="icon" aria-label="Close the banner" tooltip={false}>
            <XIcon />
          </Button>
        </div>
        <Dialog>
          <DialogTrigger>Open settings</DialogTrigger>
          <DialogBackdrop />
          <DialogContent size="sm">
            <div className="flex items-center justify-between gap-items">
              <DialogTitle>Settings</DialogTitle>
              <DialogClose variant="ghost" size="icon" aria-label="Close settings">
                <XIcon />
              </DialogClose>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </ShortcutScope>
  )
}
