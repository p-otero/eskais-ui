"use client"

import type { ChangeDetails } from "@ui-sdk/core"
import { createParts } from "@ui-sdk/react/primitive"
import { createToggleController, Toggle, type TogglePressedChangeReason } from "@ui-sdk/react/toggle"
import { useState, type ReactNode } from "react"

import { retroTv } from "@/components/ui/retro-tv-primitive"
import { ControlTooltip } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const { Root: RetroTvRoot } = createParts(retroTv, { root: "div" })

type RetroTvPhosphor = "green" | "amber" | "white"

type RetroTvLabels = {
  /** Names the power button, a toggle pressed while the set is on. */
  power: string
}

const retroTvLabels: RetroTvLabels = { power: "Power" }

type RetroTvState = { power: boolean; disabled: boolean }

type RetroTvPowerChangeDetails = ChangeDetails<TogglePressedChangeReason>

type RetroTvProps = {
  /** The accessible name of the set, as a group. */
  label: string
  /** What the screen shows, in phosphor: text, stat cards, charts. It fills a 4:3 box sized by `--retro-tv-screen-width` and `--retro-tv-screen-height`. */
  children?: ReactNode
  /** Whether the set is on. Pass it to control the set. */
  power?: boolean
  /** Whether the set starts on, when uncontrolled. `true` by default. */
  defaultPower?: boolean
  /** Runs when the power button or an agent switches the set, with UI SDK's toggle details; `details.cancel()` keeps it as it is. */
  onPowerChange?: (power: boolean, details: RetroTvPowerChangeDetails) => void
  /** The colour of the phosphor: `green` by default, `amber` or `white`. */
  phosphor?: RetroTvPhosphor
  /** Turns the set a little in 3D; `false` shows it straight on. `true` by default. */
  perspective?: boolean
  disabled?: boolean
  labels?: Partial<RetroTvLabels>
  /** Classes for the root; a function gets the set's state. */
  className?: string | ((state: RetroTvState) => string | undefined)
}

/**
 * A 1980s tube TV with a wood cabinet: its screen shows any children in phosphor, behind curved glass with scanlines,
 * a vignette and a flickering glare. Its power button is UI SDK's toggle; switching off collapses the picture to a line,
 * then to a dot that fades, and switching on plays it back. Agents call `powerOn` and `powerOff`.
 */
function RetroTv({
  label,
  children,
  power,
  defaultPower = true,
  onPowerChange,
  phosphor = "green",
  perspective = true,
  disabled = false,
  labels: labelOverrides,
  className,
}: RetroTvProps) {
  const labels = { ...retroTvLabels, ...labelOverrides }
  const [toggle] = useState(createToggleController)
  const [ownPower, setOwnPower] = useState(defaultPower)
  const [switched, setSwitched] = useState(false)
  const on = power ?? ownPower
  const powerState = { "data-power": on ? "on" : "off", "data-switched": switched ? "" : undefined }

  const onPressedChange = (next: boolean, details: RetroTvPowerChangeDetails) => {
    onPowerChange?.(next, details)
    if (details.canceled) return
    setSwitched(true)
    setOwnPower(next)
  }

  return (
    <RetroTvRoot
      power={toggle}
      disabled={disabled}
      aria-label={label}
      data-phosphor={phosphor}
      data-perspective={perspective ? "" : undefined}
      {...powerState}
      className={cn(typeof className === "function" ? className({ power: on, disabled }) : className)}
    >
      <div data-slot="retro-tv-set">
        <div data-slot="retro-tv-cabinet">
          <div data-slot="retro-tv-bezel">
            <div data-slot="retro-tv-tube" {...powerState}>
              <div data-slot="retro-tv-picture" inert={!on} {...powerState}>
                {children}
              </div>
              <span data-slot="retro-tv-beam" aria-hidden="true" {...powerState} />
              <span data-slot="retro-tv-glass" aria-hidden="true" {...powerState} />
            </div>
          </div>
          <div data-slot="retro-tv-panel">
            <span data-slot="retro-tv-knob" aria-hidden="true" />
            <span data-slot="retro-tv-knob" aria-hidden="true" />
            <span data-slot="retro-tv-grille" aria-hidden="true" />
            <div data-slot="retro-tv-switch">
              <span data-slot="retro-tv-led" aria-hidden="true" {...powerState} />
              <ControlTooltip label={labels.power}>
                <Toggle
                  controller={toggle}
                  pressed={on}
                  onPressedChange={onPressedChange}
                  disabled={disabled}
                  aria-label={labels.power}
                  render={(part) => <button {...part} data-slot="retro-tv-power" className="touch-target" />}
                />
              </ControlTooltip>
            </div>
          </div>
        </div>
        <span data-slot="retro-tv-side" aria-hidden="true" />
        <span data-slot="retro-tv-feet" aria-hidden="true" />
      </div>
    </RetroTvRoot>
  )
}

export { RetroTv, retroTvLabels }
export type { RetroTvLabels, RetroTvPhosphor, RetroTvPowerChangeDetails, RetroTvProps, RetroTvState }
