import { useState } from "react"

import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@/components/ui/segmented-control"

import { GitWorkspaceFrame } from "../../../../showcase/src/sections/git-workspace/frame"
import { GitMasterDemo } from "../../../../showcase/src/sections/git-workspace/git-master"

type Layout = "toggle" | "groups"

export default function Demo() {
  const [layout, setLayout] = useState<Layout>("toggle")
  return (
    <div className="flex flex-col gap-items">
      <SegmentedControl<Layout>
        aria-label="Uncommitted changes as"
        value={layout}
        onValueChange={(next) => {
          if (next) setLayout(next)
        }}
        className="ms-inset-surface mt-inset-surface self-start"
      >
        <SegmentedControlIndicator />
        <SegmentedControlItem value="toggle">One group at a time</SegmentedControlItem>
        <SegmentedControlItem value="groups">Both, as groups</SegmentedControlItem>
      </SegmentedControl>
      <GitWorkspaceFrame>
        <GitMasterDemo key={layout} initialRepo="app" worktreeLayout={layout} />
      </GitWorkspaceFrame>
    </div>
  )
}
