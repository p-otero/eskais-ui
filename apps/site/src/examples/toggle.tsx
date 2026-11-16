import { Toggle } from "@/components/ui/toggle"

export default function ToggleDemo() {
  return (
    <div className="flex items-center gap-items">
      <Toggle variant="outline">Pin project</Toggle>
      <Toggle defaultPressed>Watch</Toggle>
    </div>
  )
}
