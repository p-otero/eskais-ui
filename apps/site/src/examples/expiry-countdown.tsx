import { RotateCcwIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { ExpiryCountdown } from "@/components/ui/expiry-countdown"
import { useExpiry } from "@/components/ui/use-expiry"

const LIFETIME_MS = 75_000

export default function ExpiryCountdownDemo() {
  const [expiresAt, setExpiresAt] = useState(() => Date.now() + LIFETIME_MS)
  const expired = useExpiry(expiresAt, () => undefined)

  return (
    <div className="flex flex-wrap items-center gap-items">
      {expired ? (
        <p className="text-body-sm font-medium text-warning-soft-foreground">The link has expired.</p>
      ) : (
        <ExpiryCountdown expiresAt={expiresAt} expiresIn={(_ms, time) => `Link expires in ${time}`} />
      )}
      <Button variant="outline" size="sm" onClick={() => setExpiresAt(Date.now() + LIFETIME_MS)}>
        <RotateCcwIcon />
        Restart
      </Button>
    </div>
  )
}
