import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { toast } from "@/components/ui/toast"

export default function ContextMenuDemo() {
  return (
    <ContextMenu onAction={(value) => toast.success(`Chose ${value}`)}>
      <ContextMenuTrigger aria-label="Task Write the changelog" variant="area">
        Right-click, long-press or press Shift+F10 on Write the changelog
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem value="copy id">Copy task id</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem value="discard" destructive data-agent-confirm="Discards the Write the changelog task">
          Discard task
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
