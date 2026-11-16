import { Separator } from "@/components/ui/separator"

export default function SeparatorDemo() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-items text-body-sm">
      <div className="flex flex-col gap-inline">
        <p className="text-title-sm">Eskais UI</p>
        <p className="text-muted-foreground">Agent-native components.</p>
      </div>
      <Separator />
      <div className="flex h-5 items-center gap-items">
        <span>Docs</span>
        <Separator orientation="vertical" />
        <span>Components</span>
        <Separator orientation="vertical" />
        <span>Theming</span>
      </div>
    </div>
  )
}
