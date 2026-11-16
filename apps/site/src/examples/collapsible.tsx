import { Collapsible, CollapsibleIcon, CollapsiblePanel, CollapsibleTrigger } from "@/components/ui/collapsible"

export default function CollapsibleDemo() {
  return (
    <div className="w-full max-w-sm rounded-surface border bg-card">
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="w-full">
          Done column
          <CollapsibleIcon />
        </CollapsibleTrigger>
        <CollapsiblePanel>
          <ul className="flex flex-col gap-items px-inset-item py-inset-item text-body-sm">
            <li>Review the agent approval flow</li>
            <li>Benchmark table rendering</li>
          </ul>
        </CollapsiblePanel>
      </Collapsible>
    </div>
  )
}
