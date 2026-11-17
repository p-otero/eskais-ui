import { Button } from "@/components/ui/button"
import { ShortcutHint, ShortcutScope } from "@/components/ui/shortcuts"
import { ShortcutsDialog } from "@/components/ui/shortcuts-dialog"

export default function ShortcutsDialogDemo() {
  return (
    <ShortcutScope name="shortcuts-dialog-demo" label="Message" className="flex flex-col gap-items">
      <div className="flex flex-wrap gap-items">
        <Button variant="outline" shortcut="u">
          Mark read
        </Button>
        <Button variant="outline" shortcut="p">
          Pin
        </Button>
      </div>
      <p className="flex items-center gap-inline text-body-sm text-muted-foreground">
        Focus a button, then press <ShortcutHint keys="?" /> to list what you can do here.
      </p>
      <ShortcutsDialog />
    </ShortcutScope>
  )
}
