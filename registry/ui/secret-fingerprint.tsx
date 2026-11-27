import { cn } from "@/lib/utils"

/** Names for screen readers and agents, read in place of the mask; English by default. */
type SecretFingerprintLabels = {
  fingerprint: (fingerprint: string) => string
  /** Read when there's no fingerprint. */
  none: string
}

const secretFingerprintLabels: SecretFingerprintLabels = {
  fingerprint: (fingerprint) => `Ending in ${fingerprint}`,
  none: "No fingerprint",
}

type SecretFingerprintProps = {
  /** The few characters your server derives, like the last four; `null` shows the mask alone. Never the secret. */
  fingerprint: string | null
  labels?: Partial<SecretFingerprintLabels>
  className?: string
}

const MASK = "••••"

function SecretFingerprint({ fingerprint, labels: overrides, className }: SecretFingerprintProps) {
  const labels = { ...secretFingerprintLabels, ...overrides }
  return (
    <span data-slot="secret-fingerprint" className={cn("font-mono text-foreground", className)}>
      <span aria-hidden="true">{fingerprint === null ? MASK : `${MASK} ${fingerprint}`}</span>
      <span className="sr-only">{fingerprint === null ? labels.none : labels.fingerprint(fingerprint)}</span>
    </span>
  )
}

export { SecretFingerprint, secretFingerprintLabels }
export type { SecretFingerprintLabels, SecretFingerprintProps }
