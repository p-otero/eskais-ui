import { LivenessIndicator } from "@/components/ui/liveness-indicator"

import { GENERATED_AT, sampleTasks } from "./fixtures"

const attempts = sampleTasks.flatMap((task) => task.attempts).filter((attempt) => attempt.liveness)

export default function LivenessIndicatorDemo() {
  return (
    <ul className="flex flex-col gap-items">
      {attempts.slice(0, 4).map((attempt) => (
        <li key={attempt.id} className="flex items-center gap-items text-body-sm">
          <span className="w-24 font-mono text-caption text-muted-foreground">{attempt.id}</span>
          <LivenessIndicator
            liveness={attempt.liveness!}
            lastActivityAt={attempt.lastActivityAt}
            now={GENERATED_AT}
            locale="en-US"
            timeZone="UTC"
          />
        </li>
      ))}
    </ul>
  )
}
