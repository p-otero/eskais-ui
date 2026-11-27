import { SecretFingerprint } from "@/components/ui/secret-fingerprint"

const keys = [
  { id: "openai", name: "OpenAI API key", fingerprint: "x7Qa" },
  { id: "stripe", name: "Stripe webhook secret", fingerprint: "9f2c" },
  { id: "legacy", name: "Legacy token", fingerprint: null },
]

export default function SecretFingerprintDemo() {
  return (
    <dl className="flex w-full max-w-md flex-col gap-items text-body">
      {keys.map((key) => (
        <div key={key.id} className="flex items-center justify-between gap-group">
          <dt className="font-medium">{key.name}</dt>
          <dd>
            <SecretFingerprint fingerprint={key.fingerprint} />
          </dd>
        </div>
      ))}
    </dl>
  )
}
