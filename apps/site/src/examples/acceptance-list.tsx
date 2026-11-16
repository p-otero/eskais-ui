import { AcceptanceBar, AcceptanceList, countAcceptance } from "@/components/ui/acceptance-list"

const criteria = [
  { text: "The build has no warnings", result: "pass", evidence: "CI run 812, 4 min" },
  { text: "Empty, loading and error states are designed", result: "pass" },
  { text: "Text meets 4.5:1 contrast in every theme", result: "fail", evidence: "2.8:1 on glass in dark mode" },
  { text: "Works offline", result: "unverified" },
] as const

export default function AcceptanceListDemo() {
  return (
    <div className="flex w-full max-w-md flex-col gap-items">
      <AcceptanceBar counts={countAcceptance(criteria)} />
      <AcceptanceList criteria={criteria} />
    </div>
  )
}
