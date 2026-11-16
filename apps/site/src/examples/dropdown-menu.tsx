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
import { toast } from "@/components/ui/toast"

export default function DropdownMenuDemo() {
  return (
    <DropdownMenu onAction={(value) => toast.success(`Task ${value === "retry" ? "retried" : "archived"}`)}>
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
