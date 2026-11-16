import { DatePicker } from "@/components/ui/date-picker"

export default function DatePickerDemo() {
  return (
    <div className="flex w-full max-w-xs flex-col gap-group">
      <DatePicker label="Due date" defaultValue="2026-11-20" clearable />
      <DatePicker mode="range" labels={{ start: "Check in", end: "Check out" }} />
    </div>
  )
}
