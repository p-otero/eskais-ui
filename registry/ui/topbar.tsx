import type { ComponentProps, ReactNode } from "react"

import { cn } from "@/lib/utils"

type TopbarProps = Omit<ComponentProps<"header">, "children"> & {
  /** A logo or product name, before `leading`. */
  brand?: ReactNode
  /** A SidebarTrigger or a Breadcrumb. */
  leading?: ReactNode
  /** Search or a command palette trigger, centred. */
  center?: ReactNode
  /** Shown instead of `center` on narrow screens, usually an icon Button that opens the same thing. */
  centerCompact?: ReactNode
  /** Notifications, appearance and the user menu. */
  trailing?: ReactNode
}

// Leading and trailing grow equally from zero, so the centre slot stays centred whatever each side holds.
function Topbar({ brand, leading, center, centerCompact, trailing, className, ...props }: TopbarProps) {
  return (
    <header
      data-slot="topbar"
      className={cn(
        "sticky top-0 z-sticky flex w-full min-w-0 items-center gap-group border-b bg-background/(--glass-opacity) px-group py-items backdrop-surface narrow:gap-items narrow:px-items",
        className,
      )}
      {...props}
    >
      <div data-slot="topbar-leading" className="flex min-w-0 flex-1 items-center gap-items">
        {brand !== undefined && (
          <div data-slot="topbar-brand" className="flex shrink-0 items-center">
            {brand}
          </div>
        )}
        {leading}
      </div>
      {center !== undefined && (
        <div
          data-slot="topbar-center"
          className={cn("flex min-w-0 flex-1 justify-center", centerCompact !== undefined && "narrow:hidden")}
        >
          {center}
        </div>
      )}
      <div data-slot="topbar-trailing" className="flex min-w-0 flex-1 items-center justify-end gap-items">
        {centerCompact !== undefined && (
          <div data-slot="topbar-center-compact" className="hidden narrow:flex">
            {centerCompact}
          </div>
        )}
        {trailing}
      </div>
    </header>
  )
}

export { Topbar }
export type { TopbarProps }
