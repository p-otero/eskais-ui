import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs"

import { Section } from "../section"

const views = ["Overview", "Deployments", "Logs", "Analytics", "Agents", "Usage", "Domains", "Secrets", "Settings"]

function ScrollingTabsSection() {
  return (
    <Section
      title="Tabs that scroll"
      description="When the tabs don't fit, the list scrolls with edge fades, and on a mouse or trackpad, buttons at each edge. Arrow keys still reach every tab, and selecting one scrolls it into view."
    >
      <Tabs defaultValue="Overview" className="w-full max-w-xs">
        <TabsList aria-label="Deployment views">
          {views.map((view) => (
            <TabsTab key={view} value={view}>
              {view}
            </TabsTab>
          ))}
        </TabsList>
        {views.map((view) => (
          <TabsPanel key={view} value={view}>
            <p className="text-sm text-muted-foreground">{view} for Apollo.</p>
          </TabsPanel>
        ))}
      </Tabs>
    </Section>
  )
}

export { ScrollingTabsSection }
