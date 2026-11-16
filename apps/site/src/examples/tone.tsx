import { Badge } from "@/components/ui/badge"
import { StatusDot } from "@/components/ui/status-pill"
import { Tone, tones } from "@/lib/tone"

const meaning: Record<Tone, string> = {
  neutral: "No judgement",
  info: "In progress",
  success: "Done, healthy",
  warning: "Needs attention",
  destructive: "Failed, blocked",
  violet: "A category",
}

export default function ToneDemo() {
  return (
    <ul className="grid w-full max-w-lg grid-cols-2 gap-items sm:grid-cols-3">
      {tones.map((tone) => (
        <li key={tone} className="flex flex-col gap-inline rounded-surface border bg-card px-inset-item py-inset-item">
          <span className="flex items-center gap-inline">
            <StatusDot tone={tone} label={tone} />
            <Badge tone={tone}>{tone}</Badge>
          </span>
          <span className="text-caption text-muted-foreground">{meaning[tone]}</span>
        </li>
      ))}
    </ul>
  )
}
