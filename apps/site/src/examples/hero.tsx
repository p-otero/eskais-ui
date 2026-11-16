import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Hero } from "@/components/ui/hero"

export default function HeroDemo() {
  return (
    <Hero
      headingLevel={2}
      eyebrow="Now in beta"
      title="Ship the page,"
      titleMuted="not the layout."
      description="Pass the copy, the actions and a live demo; the hero lays them out by its container's width."
      actions={
        <>
          <Button>Get started</Button>
          <Button variant="outline">Read the docs</Button>
        </>
      }
      install="npx shadcn@latest add @eskais/hero"
      aside={
        <div className="flex flex-col gap-items rounded-surface border bg-card p-inset-surface shadow-surface">
          <p className="text-title-sm">Any node goes here</p>
          <div className="flex flex-wrap gap-inline">
            <Badge tone="success">Live</Badge>
            <Badge tone="info">Interactive</Badge>
          </div>
        </div>
      }
      className="w-full"
    />
  )
}
