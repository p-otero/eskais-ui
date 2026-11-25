import type { CSSProperties } from "react"

import { List, ListItem } from "@/components/ui/list-item"
import { MasterDetail, type MasterDetailProps } from "@/components/ui/master-detail"

const devices = Array.from({ length: 24 }, (_, index) => ({
  id: `dev-${String(index + 1)}`,
  name: `Device ${String(index + 1)}`,
  room: ["Kitchen", "Hall", "Garage", "Office"][index % 4] ?? "Kitchen",
}))

function Devices(props: Omit<Partial<MasterDetailProps>, "label"> & { label: string }) {
  return (
    <MasterDetail
      items={devices.map((device) => ({ id: device.id, label: device.name }))}
      labels={{ list: `${props.label} list`, detail: `${props.label} detail` }}
      renderList={(state) => (
        <List aria-label={`${props.label} rows`}>
          {devices.map((device) => (
            <ListItem key={device.id} title={device.name} subtitle={device.room} {...state.itemProps(device.id)} />
          ))}
        </List>
      )}
      renderDetail={(id) => {
        const device = devices.find((candidate) => candidate.id === id)
        return device ? { title: device.name, description: device.room, content: <p>Online</p> } : null
      }}
      {...props}
    />
  )
}

function MasterDetailCheck() {
  return (
    <main className="flex flex-col gap-section p-inset-surface">
      <h1 className="text-display-sm tracking-tight">MasterDetail check</h1>
      <div data-testid="narrow-box" className="h-144 w-md max-w-full overflow-hidden rounded-surface border">
        <Devices
          label="Monitored devices"
          idleDetail="visible"
          emptyDetailTitle="Monitor"
          emptyDetail={
            <ul aria-label="Events" className="flex flex-col gap-items text-body-sm">
              {devices.map((device) => (
                <li key={device.id}>{device.name} reported in</li>
              ))}
            </ul>
          }
        />
      </div>
      <p className="text-body text-muted-foreground">Text above the content-sized block.</p>
      <Devices
        label="Content sized"
        height="auto"
        style={{ "--master-detail-max-height": "24rem" } as CSSProperties}
        emptyDetail={<p>Pick a device</p>}
      />
      <Devices
        label="Few rows"
        height="auto"
        renderList={(state) => (
          <List aria-label="Few rows list">
            <ListItem title="Only device" {...state.itemProps("dev-1")} />
          </List>
        )}
        emptyDetail={<p>Pick a device</p>}
      />
      <p className="text-body text-muted-foreground">Text below it.</p>
    </main>
  )
}

export { MasterDetailCheck }
