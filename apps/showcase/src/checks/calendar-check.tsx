import { Calendar } from "@/components/ui/calendar"
import { DatePicker } from "@/components/ui/date-picker"

// ?demo=calendar-check: range calendars for tooling/calendar-check.mjs, which screenshots and measures the band.
const ranges = [
  { id: "week", value: ["2026-11-09", "2026-11-13"] },
  { id: "weeks", value: ["2026-11-12", "2026-11-24"] },
  { id: "one-day", value: ["2026-11-18", "2026-11-18"] },
  { id: "two-days", value: ["2026-11-14", "2026-11-15"] },
  { id: "empty", value: null },
] as const

function CalendarCheck() {
  return (
    <main className="flex flex-col gap-section p-section">
      {(["ltr", "rtl"] as const).map((dir) => (
        <div key={dir} dir={dir} className="flex flex-wrap items-start gap-section">
          {ranges.map((range) => (
            <div key={range.id} data-testid={`calendar-${dir}-${range.id}`} className="w-fit">
              <Calendar
                mode="range"
                defaultValue={range.value === null ? null : [...range.value]}
                defaultMonth="2026-11"
                today="2026-11-17"
                locale={dir === "rtl" ? "he-IL" : "en-US"}
                aria-label={`${range.id} ${dir}`}
              />
            </div>
          ))}
        </div>
      ))}
      <div data-testid="date-picker" className="w-full max-w-xs">
        <DatePicker
          mode="range"
          defaultValue={["2026-11-12", "2026-11-24"]}
          locale="en-US"
          labels={{ start: "Check in", end: "Check out" }}
        />
      </div>
    </main>
  )
}

export { CalendarCheck }
