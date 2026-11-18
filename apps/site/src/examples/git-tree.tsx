import { useState } from "react"

import { GitTree } from "@/components/ui/git-tree"
import type { GitTreeFile } from "@/lib/git-status"

const files: (string | GitTreeFile)[] = [
  "package.json",
  "README.md",
  "tsconfig.json",
  { path: "src/routes.ts", status: "added" },
  "src/index.ts",
  { path: "src/billing/proration.ts", status: "modified" },
  "src/billing/plans.ts",
  { path: "src/billing/legacy-rates.ts", status: "deleted" },
  { path: "src/invoice/pdf.ts", status: "renamed", from: "src/invoice/print.ts" },
  "src/invoice/fonts.ts",
  "docs/billing.md",
  "public/logo.svg",
]

export default function GitTreeDemo() {
  const [current, setCurrent] = useState<string | null>("src/billing/proration.ts")
  return (
    <div className="flex w-full max-w-sm flex-col gap-items">
      <GitTree
        aria-label="Files at e02c6d9"
        className="max-h-96"
        files={files}
        current={current}
        onOpenFile={setCurrent}
      />
      <p className="text-caption text-muted-foreground" aria-live="polite">
        {current ?? "No file open"}
      </p>
    </div>
  )
}
