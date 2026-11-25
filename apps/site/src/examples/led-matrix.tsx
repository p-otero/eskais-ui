import { LedMatrix } from "@/components/ui/led-matrix"

export default function LedMatrixDemo() {
  return (
    <div className="w-full max-w-2xl">
      <LedMatrix
        label="Pharmacy"
        defaultMessages={["Pharmacy on duty: 12 Harbour Street", "Open until 22:00 · Café 2,50 €"]}
      />
    </div>
  )
}
