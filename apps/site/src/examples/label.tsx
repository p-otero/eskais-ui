import { Checkbox, CheckboxIndicator } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

export default function LabelDemo() {
  return (
    <Label>
      <Checkbox>
        <CheckboxIndicator />
      </Checkbox>
      Accept the terms
    </Label>
  )
}
