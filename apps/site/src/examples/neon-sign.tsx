import { useState } from "react"

import { Label } from "@/components/ui/label"
import { NeonSign } from "@/components/ui/neon-sign"
import { Switch } from "@/components/ui/switch"

export default function NeonSignDemo() {
  const [live, setLive] = useState(true)
  return (
    <div className="flex w-full max-w-2xl flex-col gap-items">
      <NeonSign
        label="Studio"
        text="On air"
        sub="Studio 2"
        color="red"
        subColor="cyan"
        on={live}
        onOnChange={setLive}
      />
      <Label>
        <Switch checked={live} onCheckedChange={setLive} />
        Live
      </Label>
    </div>
  )
}
