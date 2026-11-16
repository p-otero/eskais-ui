import { SkipLink } from "@/components/ui/skip-link"

export default function SkipLinkDemo() {
  return (
    <div className="flex flex-col items-center gap-items text-body-sm text-muted-foreground">
      <p>Press Tab here: the link shows while it has focus.</p>
      <SkipLink href="#main">Skip to content</SkipLink>
    </div>
  )
}
