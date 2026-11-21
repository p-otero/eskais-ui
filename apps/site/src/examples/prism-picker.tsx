import { useState } from "react"

import { PrismPicker, type PrismColor } from "@/components/ui/prism-picker"

export default function PrismPickerDemo() {
  const [color, setColor] = useState<PrismColor>()
  return (
    <div className="flex w-full max-w-2xl flex-col gap-items">
      <PrismPicker label="Accent colour" defaultValue={480} onColorChange={setColor} />
      <p className="text-body-sm text-muted-foreground">
        {color ? `${color.hex} · ${String(color.wavelength)} nm` : "Turn the prism to pick a colour."}
      </p>
    </div>
  )
}
