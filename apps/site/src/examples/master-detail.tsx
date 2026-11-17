import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { List, ListItem } from "@/components/ui/list-item"
import { MasterDetail } from "@/components/ui/master-detail"
import { SearchField } from "@/components/ui/search-field"
import { StatusPill } from "@/components/ui/status-pill"
import type { Tone } from "@/lib/tone"

type Device = {
  id: string
  name: string
  room: string
  status: { label: string; tone: Tone }
  battery: number
  firmware: string
  lastSeen: string
}

const devices: Device[] = [
  {
    id: "dev-01",
    name: "Kitchen sensor",
    room: "Kitchen",
    status: { label: "Online", tone: "success" },
    battery: 82,
    firmware: "2.4.1",
    lastSeen: "Just now",
  },
  {
    id: "dev-02",
    name: "Hall camera",
    room: "Hall",
    status: { label: "Updating", tone: "info" },
    battery: 100,
    firmware: "5.0.0",
    lastSeen: "1 min ago",
  },
  {
    id: "dev-03",
    name: "Garage door",
    room: "Garage",
    status: { label: "Low battery", tone: "warning" },
    battery: 9,
    firmware: "1.9.7",
    lastSeen: "4 min ago",
  },
  {
    id: "dev-04",
    name: "Porch light",
    room: "Porch",
    status: { label: "Offline", tone: "destructive" },
    battery: 0,
    firmware: "3.1.0",
    lastSeen: "2 days ago",
  },
  {
    id: "dev-05",
    name: "Office thermostat",
    room: "Office",
    status: { label: "Online", tone: "success" },
    battery: 64,
    firmware: "4.2.2",
    lastSeen: "Just now",
  },
  {
    id: "dev-06",
    name: "Nursery monitor",
    room: "Nursery",
    status: { label: "Online", tone: "success" },
    battery: 47,
    firmware: "2.0.3",
    lastSeen: "12 s ago",
  },
]

export default function MasterDetailDemo({ className = "h-128" }: { className?: string }) {
  const [query, setQuery] = useState("")
  const shown = devices.filter((device) => `${device.name} ${device.room}`.toLowerCase().includes(query.toLowerCase()))
  return (
    <MasterDetail
      label="Devices"
      className={`w-full rounded-surface border ${className}`}
      items={devices.map((device) => ({ id: device.id, label: device.name }))}
      collapsible
      resizable
      followFocus
      storageKey="demo-devices"
      labels={{ list: "Device list" }}
      header={
        <>
          <h2 className="text-title-sm tracking-tight">Devices</h2>
          <Badge variant="secondary">{shown.length}</Badge>
        </>
      }
      toolbar={
        <SearchField label="Filter devices" placeholder="Filter devices" onSearch={setQuery} className="w-full" />
      }
      renderList={(state) => (
        <List aria-label="Devices by room">
          {shown.map((device) => (
            <ListItem
              key={device.id}
              {...state.itemProps(device.id)}
              title={device.name}
              subtitle={device.room}
              status={<StatusPill tone={device.status.tone}>{device.status.label}</StatusPill>}
            />
          ))}
        </List>
      )}
      renderDetail={(id) => {
        const device = devices.find((candidate) => candidate.id === id)
        if (!device) return null
        return {
          title: device.name,
          description: `${device.room} · last seen ${device.lastSeen}`,
          actions: (
            <Button size="sm" variant="outline">
              Restart
            </Button>
          ),
          content: (
            <dl className="flex flex-col gap-inline text-body-sm">
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <StatusPill tone={device.status.tone}>{device.status.label}</StatusPill>
              </dd>
              <dt className="text-muted-foreground">Battery</dt>
              <dd className="tabular-nums">{device.battery}%</dd>
              <dt className="text-muted-foreground">Firmware</dt>
              <dd className="font-mono">{device.firmware}</dd>
              <dt className="text-muted-foreground">Device id</dt>
              <dd className="font-mono">{device.id}</dd>
            </dl>
          ),
        }
      }}
      emptyDetail={
        <Empty size="panel">
          <EmptyHeader>
            <EmptyTitle>No device open</EmptyTitle>
            <EmptyDescription>Pick a device to see its status, battery and firmware.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      }
    />
  )
}
