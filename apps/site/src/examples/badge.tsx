import { Badge } from "@/components/ui/badge"

export default function BadgeDemo() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-items">
      <Badge>Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge tone="neutral">Draft</Badge>
      <Badge tone="info">Preview</Badge>
      <Badge tone="success">Ready</Badge>
      <Badge tone="warning">Building</Badge>
      <Badge tone="destructive">Failed</Badge>
      <Badge tone="violet">Design</Badge>
    </div>
  )
}
