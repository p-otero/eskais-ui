import { Badge } from "@/components/ui/badge"
import { CheckboxRow } from "@/components/ui/checkbox-row"

export default function CheckboxRowDemo() {
  return (
    <div className="flex w-full max-w-md flex-col gap-items">
      <CheckboxRow
        defaultChecked
        label="Email me a weekly summary"
        description="Sent on Monday mornings, in your time zone."
      />
      <CheckboxRow label="Share usage with the team" trailing={<Badge variant="secondary">Beta</Badge>} />
      <CheckboxRow
        label="Sync over mobile data"
        description="Large uploads wait for Wi-Fi."
        disabled={{ reason: "Your organization turned this off." }}
      />
    </div>
  )
}
