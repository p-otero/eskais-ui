import { PrismPicker } from "@/components/ui/prism-picker"

import "../../../../registry/styles/prism-picker.css"

function PrismPickerScenario() {
  return (
    <div className="w-full max-w-3xl">
      <PrismPicker label="Prism colour" defaultValue={520} />
    </div>
  )
}

export { PrismPickerScenario }
