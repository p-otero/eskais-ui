import { Calendar } from "@/components/ui/calendar"

export default function CalendarDemo() {
  return <Calendar mode="range" defaultValue={["2026-11-09", "2026-11-13"]} locale="en-US" />
}
