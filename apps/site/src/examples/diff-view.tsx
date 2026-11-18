import { useMemo } from "react"

import { DiffView } from "@/components/ui/diff-view"
import { toViewFiles } from "@/components/ui/diff-view-model"
import { diffFile } from "@/lib/diff-lines"

const before = "name: eskais\nversion: 0.2.0\nprivate: true\n"
const after = "name: eskais\nversion: 0.3.0\nprivate: true\nlicense: MIT\n"

export default function DiffViewDemo() {
  const files = useMemo(() => toViewFiles([diffFile(before, after, { oldPath: "package.yml" })]), [])
  return <DiffView aria-label="package.yml changes" files={files} headers defaultLayout="split" className="w-full" />
}
