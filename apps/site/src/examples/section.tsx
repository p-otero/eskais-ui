import { Button } from "@/components/ui/button"
import { Section } from "@/components/ui/section"

export default function SectionDemo() {
  return (
    <div className="grid w-full gap-section md:grid-cols-2">
      <Section
        eyebrow="Last 7 days"
        title="Deployments"
        description="Builds that reached production."
        action={
          <Button size="sm" variant="outline">
            Export
          </Button>
        }
      >
        <p className="text-display-sm">42</p>
      </Section>
      <Section surface="dashed" title="Create a project" description="Start from a template or an empty repo.">
        <Button variant="secondary">Choose a template</Button>
      </Section>
    </div>
  )
}
