import { Mixer } from "@/components/ui/mixer"
import { SafeDial } from "@/components/ui/safe-dial"
import { SafeVault } from "@/components/ui/safe-vault"
import { SunArc } from "@/components/ui/sun-arc"
import { VinylScrubber } from "@/components/ui/vinyl-scrubber"

import cebuSkyline from "../assets/cebu-skyline.jpg"
import "../../../../registry/styles/mixer.css"
import "../../../../registry/styles/safe-dial.css"
import "../../../../registry/styles/safe-vault.css"
import "../../../../registry/styles/sun-arc.css"
import "../../../../registry/styles/vinyl-scrubber.css"

const day = new Date("2026-11-25T12:00:00Z")
const channels = ["Sales", "Support", "Product", "Brand", "Research", "Ops"].map((label) => ({
  id: label.toLowerCase(),
  label,
}))
const peaks = Array.from({ length: 2000 }, (_, index) => 0.3 + 0.7 * Math.abs(Math.sin(index * 0.37)))

function SunArcScenario() {
  return (
    <div className="w-full max-w-3xl">
      <SunArc label="Meeting time" latitude={43.37} longitude={-8.4} timeZone="Europe/Madrid" date={day} step={1} />
    </div>
  )
}

const cebu = { latitude: 10.326725, longitude: 123.904889, timeZone: "Asia/Manila" }

function SunArcPhotoScenario() {
  return (
    <div className="w-full max-w-3xl">
      <SunArc
        label="Meeting time"
        {...cebu}
        date={new Date("2025-04-14T04:00:00Z")}
        defaultValue={6 * 60 + 20}
        step={1}
        photo={{ src: cebuSkyline, heading: 82 }}
      />
    </div>
  )
}

function MixerScenario() {
  return (
    <div className="w-full max-w-2xl">
      <Mixer label="Budget split" channels={channels} defaultLocked={["ops"]} />
    </div>
  )
}

function SafeDialScenario() {
  return (
    <div className="w-full max-w-md">
      <SafeDial label="Vault combination" />
    </div>
  )
}

function SafeVaultScenario() {
  return (
    <div className="w-full max-w-3xl">
      <SafeVault label="Vault" status="locked" />
    </div>
  )
}

function VinylScrubberScenario() {
  return (
    <div className="w-full max-w-3xl">
      <VinylScrubber label="Track" duration={400} defaultValue={72} peaks={peaks} step={1} />
    </div>
  )
}

export {
  MixerScenario,
  SafeDialScenario,
  SafeVaultScenario,
  SunArcPhotoScenario,
  SunArcScenario,
  VinylScrubberScenario,
}
