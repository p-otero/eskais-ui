import { Button } from "@/components/ui/button"
import { SectionHeading } from "@/components/ui/section-heading"

export default function SectionHeadingDemo() {
  return (
    <section aria-labelledby="demo-features" className="flex w-full flex-col gap-section">
      <SectionHeading
        headingId="demo-features"
        eyebrow="Features"
        title="Everything is a block."
        description="An eyebrow, a title, a description and actions that move below the title on narrow containers."
        actions={<Button variant="outline">All features</Button>}
      />
      <SectionHeading align="center" headingLevel={3} title="Centered, one level down." />
    </section>
  )
}
