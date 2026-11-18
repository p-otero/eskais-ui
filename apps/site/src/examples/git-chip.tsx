import { GitBranchChip, GitFileChip } from "@/components/ui/git-chip"

export default function GitChipDemo() {
  return (
    <p className="text-body">
      Merge <GitBranchChip name="invoice-pdf" /> into <GitBranchChip name="main" />, then add the route in{" "}
      <GitFileChip path="src/routes.ts" />.
    </p>
  )
}
