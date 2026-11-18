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

/**
 * ?demo=master-detail-check, for tooling/layout-blocks-check.mjs: an idle detail kept under the list in a narrow
 * container.
 */
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
    </main>
  )
}

export { MasterDetailCheck }
