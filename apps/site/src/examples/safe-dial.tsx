import { useState } from "react"

import { SafeDial } from "@/components/ui/safe-dial"

export default function SafeDialDemo() {
  const [opened, setOpened] = useState<string>()
  return (
    <div className="flex w-full max-w-sm flex-col gap-items">
      <SafeDial label="Vault" length={3} onComplete={setOpened} />
      <p className="text-body-sm text-muted-foreground">
        {opened ? `Entered ${opened}` : "Turn and let go, three times."}
      </p>
    </div>
  )
}
