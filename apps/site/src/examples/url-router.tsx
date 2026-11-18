import { useState, useSyncExternalStore } from "react"

import { Code } from "@/components/ui/code-block"
import { List, ListItem } from "@/components/ui/list-item"
import { createUrlParam } from "@/lib/url-param"
import { memoryRouter } from "@/lib/url-router"

const devices = [
  { id: "a1", name: "Kitchen sensor" },
  { id: "b2", name: "Hall camera" },
  { id: "c3", name: "Garage door" },
]

export default function UrlRouterDemo() {
  // A memory router stands in for the app's: hashRouter() would write #/devices?sort=name&device=a1.
  const [router] = useState(() => memoryRouter("/devices?sort=name"))
  const [device] = useState(() => createUrlParam("device", { router }))
  const selected = useSyncExternalStore(router.subscribe, device.read, device.read)
  const href = useSyncExternalStore(
    router.subscribe,
    () => router.href(router.read()),
    () => router.href(router.read()),
  )
  return (
    <div className="flex w-full max-w-md flex-col gap-group">
      <List aria-label="Devices">
        {devices.map((item) => (
          <ListItem
            key={item.id}
            id={item.id}
            title={item.name}
            selected={item.id === selected}
            onSelect={() => device.write(item.id)}
          />
        ))}
      </List>
      <p className="flex flex-wrap items-center gap-inline text-body-sm text-muted-foreground">
        Location <Code>{href}</Code>, {router.entries.length} navigations
      </p>
    </div>
  )
}
