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

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  )
}

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
      <ToastStack />
    </Section>
  )
}

export { OverlaysSection }
