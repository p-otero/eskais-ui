import { CopyIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuGroupLabel,
  DropdownMenuItem,
  DropdownMenuItemIndicator,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ToastStack, toast } from "@/components/ui/toast"
import { Tooltip, TooltipContent, TooltipShortcut, TooltipTrigger } from "@/components/ui/tooltip"

import { Section } from "../section"

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
        <p className="text-sm">The first attempt hit a rate limit after 1,204 of 3,310 pages.</p>
        <DrawerFooter>
          <DrawerClose>Close task</DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

function TaskActions() {
  return (
    <DropdownMenu
      onAction={(value) =>
        toast.success(`Task ${value === "retry" ? "retried" : "archived"}`, {
          description: "Index the docs",
          action: { label: "Undo", onAction: () => {} },
        })
      }
    >
      <DropdownMenuTrigger aria-label="Actions for Index the docs">Actions</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuGroupLabel>Index the docs</DropdownMenuGroupLabel>
          <DropdownMenuItem value="retry" shortcut="mod+r">
            Retry
            <DropdownMenuShortcut />
          </DropdownMenuItem>
          <DropdownMenuItem value="archive">Archive</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem value="watch" defaultChecked>
          <DropdownMenuItemIndicator />
          Watch
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          destructive
          data-agent-confirm="Deletes the Index the docs task"
          onSelect={() => toast.error("Task deleted", { description: "Index the docs" })}
        >
          Delete task
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function showToastTypes() {
  const stay = { duration: Number.POSITIVE_INFINITY }
  toast("Run queued", { ...stay, description: "Starts in about a minute" })
  toast.loading("Uploading the attempt log", stay)
  toast.info("Rebuilding the index", { ...stay, description: "About two minutes left" })
  toast.success("Task archived", { ...stay, description: "Index the docs" })
  toast.warning("Quota at 90%", { ...stay, description: "Runs pause at 100%" })
  toast.error("Deploy failed", { ...stay, description: "The build step exited with code 1" })
}

function OverlaysSection() {
  return (
    <Section
      title="Overlays"
      description="Tooltip, popover, drawer, dropdown menu and toast. Floating surfaces turn glassy with the glass theme."
    >
      <Tooltip>
        <TooltipTrigger render={<Button variant="outline" size="icon" aria-label="Copy model ID" />}>
          <CopyIcon />
        </TooltipTrigger>
        <TooltipContent>Copy model ID</TooltipContent>
      </Tooltip>
      <Tooltip shortcut="mod+e">
        <TooltipTrigger render={<Button variant="ghost" />}>Estimate</TooltipTrigger>
        <TooltipContent>
          About $0.42 for 12k tokens
          <TooltipShortcut />
        </TooltipContent>
      </Tooltip>
      <Popover>
        <PopoverTrigger>Attempt 2 details</PopoverTrigger>
        <PopoverContent>
          <PopoverTitle>Attempt 2</PopoverTitle>
          <PopoverDescription>Retried 30 seconds after a rate limit.</PopoverDescription>
          <dl className="grid grid-cols-2 gap-1 text-sm">
            <dt className="text-muted-foreground">Model</dt>
            <dd>claude-opus-5-5</dd>
            <dt className="text-muted-foreground">Tokens</dt>
            <dd>12,480</dd>
          </dl>
          <PopoverClose className="self-end">Done</PopoverClose>
        </PopoverContent>
      </Popover>
      <TaskDrawer side="right" label="Open task panel" />
      <TaskDrawer side="bottom" label="Open task sheet" />
      <TaskActions />
      <Button variant="secondary" onClick={() => toast("Run queued", { description: "Starts in about a minute" })}>
        Show toast
      </Button>
      <Button variant="secondary" onClick={showToastTypes}>
        Show toast types
      </Button>
      <ToastStack maxVisible={6} />
    </Section>
  )
}

export { OverlaysSection }
