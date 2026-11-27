import { CopyIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { SafeVault, type SafeVaultStatus } from "@/components/ui/safe-vault"

const combination = "27461333"

export default function SafeVaultDemo() {
  const [status, setStatus] = useState<SafeVaultStatus>("locked")
  return (
    <div className="w-full max-w-2xl">
      <SafeVault
        label="Vault"
        status={status}
        onStatusChange={setStatus}
        onComplete={(code) => setStatus(code === combination ? "unlocked" : "denied")}
      >
        <div className="flex flex-col gap-items">
          <h3 className="text-title-sm">Recovery code</h3>
          <code className="font-mono text-body-sm">esk_demo_7cWm-P4vR-8eLk</code>
          <Button size="sm" variant="outline" className="w-fit">
            <CopyIcon />
            Copy
          </Button>
        </div>
      </SafeVault>
    </div>
  )
}
