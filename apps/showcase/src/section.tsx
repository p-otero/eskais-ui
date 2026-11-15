import { useId, type ReactNode } from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  const titleId = useId()
  return (
    <Card render={<section aria-labelledby={titleId} />}>
      <CardHeader>
        <CardTitle render={<h2 id={titleId}>{title}</h2>} />
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-3">{children}</div>
      </CardContent>
    </Card>
  )
}

export { Section }
