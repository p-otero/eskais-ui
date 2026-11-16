import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar"
import { toast } from "@/components/ui/toast"

export default function MenubarDemo() {
  return (
    <Menubar aria-label="Board menu">
      <MenubarMenu onAction={(value) => toast.success(`Chose ${value}`)}>
        <MenubarTrigger>File</MenubarTrigger>
        <MenubarContent>
          <MenubarItem value="new task" shortcut="mod+alt+n">
            New task
            <MenubarShortcut />
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem value="export">Export board</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu onAction={(value) => toast.success(`Chose ${value}`)}>
        <MenubarTrigger>View</MenubarTrigger>
        <MenubarContent>
          <MenubarItem value="zoom">Zoom to fit</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  )
}
