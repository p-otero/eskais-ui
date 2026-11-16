import { RelativeTime, useNow } from "@/components/ui/relative-time"

export default function RelativeTimeDemo() {
  const now = useNow()
  const minutesAgo = (minutes: number) => new Date(now - minutes * 60_000).toISOString()
  return (
    <dl className="grid grid-cols-2 gap-x-group gap-y-inline text-body">
      <dt className="text-muted-foreground">Updated (UTC)</dt>
      <dd>
        <RelativeTime value={minutesAgo(5)} now={now} locale="en-US" timeZone="UTC" />
      </dd>
      <dt className="text-muted-foreground">Actualizado (Madrid)</dt>
      <dd>
        <RelativeTime value={minutesAgo(190)} now={now} locale="es-ES" timeZone="Europe/Madrid" />
      </dd>
    </dl>
  )
}
