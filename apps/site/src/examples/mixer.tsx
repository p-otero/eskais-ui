import { Mixer } from "@/components/ui/mixer"

const channels = [
  { id: "search", label: "Search" },
  { id: "social", label: "Social" },
  { id: "email", label: "Email" },
  { id: "events", label: "Events" },
]

export default function MixerDemo() {
  return (
    <div className="w-full max-w-lg">
      <Mixer
        label="Marketing budget"
        channels={channels}
        defaultValue={{ search: 40, social: 25, email: 20, events: 15 }}
        defaultLocked={["events"]}
        format={{ style: "unit", unit: "percent" }}
      />
    </div>
  )
}
