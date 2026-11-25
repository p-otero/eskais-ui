import { Button } from "@/components/ui/button"
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Section } from "@/components/ui/section"

const widths = ["15rem", "19rem", "22rem", "26rem"] as const

const actions = {
  short: <Button size="sm">Edit</Button>,
  wide: (
    <>
      <Button size="sm" variant="outline">
        Export
      </Button>
      <Button size="sm">View all deployments</Button>
    </>
  ),
}

function CardHeaderCheck() {
  return (
    <main className="flex flex-col gap-section p-section">
      {widths.map((width) => (
        <div key={width} className="flex flex-wrap items-start gap-section">
          {(["short", "wide"] as const).map((kind) => (
            <div key={kind} data-width={width} data-action={kind} style={{ width }} className="flex flex-col gap-items">
              <Card data-testid={`card-${width}-${kind}`}>
                <CardHeader>
                  <CardTitle headingLevel={2}>Monthly usage</CardTitle>
                  <CardDescription>Requests across every project this month.</CardDescription>
                  <CardAction>{actions[kind]}</CardAction>
                </CardHeader>
              </Card>
              <Section
                data-testid={`section-${width}-${kind}`}
                title="Deployments"
                description="The latest builds of each project."
                action={actions[kind]}
              />
            </div>
          ))}
        </div>
      ))}
    </main>
  )
}

export { CardHeaderCheck }
