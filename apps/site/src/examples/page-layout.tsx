import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { PageLayout } from "@/components/ui/page-layout"
import { Section } from "@/components/ui/section"

export default function PageLayoutDemo() {
  return (
    <div className="w-full overflow-hidden rounded-surface border bg-background">
      <PageLayout
        header={
          <PageHeader
            headingLevel={2}
            eyebrow="Workspace"
            title="Projects"
            description="Every project, with its latest deployment."
            actions={<Button>New project</Button>}
          />
        }
      >
        <Section title="Deployments" headingLevel={3} description="Last 7 days.">
          <p className="text-display-sm">42</p>
        </Section>
      </PageLayout>
    </div>
  )
}
