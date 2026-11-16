import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"

export default function PageHeaderDemo() {
  return (
    <PageHeader
      className="w-full"
      headingLevel={2}
      eyebrow="Projects"
      title="Deployments"
      description="Every deploy of the last 30 days, newest first."
      actions={<Button>New deployment</Button>}
    />
  )
}
