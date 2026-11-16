import { StatusDot, StatusPill } from "@/components/ui/status-pill"

export default function StatusPillDemo() {
  return (
    <div className="flex flex-col items-center gap-group">
      <div className="flex flex-wrap items-center justify-center gap-items">
        <StatusPill tone="neutral">Draft</StatusPill>
        <StatusPill tone="info" dot pulse>
          Running
        </StatusPill>
        <StatusPill tone="success" dot>
          Passed
        </StatusPill>
        <StatusPill tone="warning" dot>
          Waiting
        </StatusPill>
        <StatusPill tone="destructive" dot>
          Failed
        </StatusPill>
        <StatusPill tone="muted">Archived</StatusPill>
      </div>
      <ul className="flex flex-wrap items-center gap-group text-body-sm">
        <li className="flex items-center gap-inline">
          <StatusDot tone="success" label="Online" pulse />
          api-1
        </li>
        <li className="flex items-center gap-inline">
          <StatusDot tone="warning" label="Degraded" />
          api-2
        </li>
        <li className="flex items-center gap-inline">
          <StatusDot tone="destructive" label="Offline" />
          worker-1
        </li>
      </ul>
    </div>
  )
}
