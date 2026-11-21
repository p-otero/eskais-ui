import { PrismPicker } from "@/components/ui/prism-picker"

import "../../../../registry/styles/prism-picker.css"

/** The prism picker's key presses: each one renders the readout and repaints the canvases in its layout effect. */
function PrismPickerScenario() {
  return (
    <div className="w-full max-w-3xl">
      <PrismPicker label="Prism colour" defaultValue={520} />
    </div>
  )
}

export { PrismPickerScenario }
