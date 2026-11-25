import { RetroTv } from "@/components/ui/retro-tv"

const signups = [12, 18, 15, 24, 21, 30, 27, 36].map((value, index) => ({ hour: `${String(9 + index)}:00`, value }))

export default function RetroTvDemo() {
  return (
    <div className="w-full max-w-xl">
      <RetroTv label="Sign-ups monitor">
        <div className="flex h-full flex-col justify-between gap-items px-inset-item py-inset-item text-caption">
          <span className="uppercase">Sign-ups · today</span>
          <span className="text-display-sm leading-none">1,284</span>
          <span className="sr-only">Sign-ups per hour, rising</span>
          <div className="flex h-12 items-end gap-inline" aria-hidden="true">
            {signups.map(({ hour, value }) => (
              <span key={hour} className="flex-1 bg-primary" style={{ height: `${String((value / 36) * 100)}%` }} />
            ))}
          </div>
          <span className="text-muted-foreground uppercase">Queue 3 · API ok</span>
        </div>
      </RetroTv>
    </div>
  )
}
