import { GitWorkspaceFrame } from "../../../../showcase/src/sections/git-workspace/frame"
import { GitCommitDemo } from "../../../../showcase/src/sections/git-workspace/git-commit"

export default function Demo() {
  return (
    <GitWorkspaceFrame>
      <GitCommitDemo />
    </GitWorkspaceFrame>
  )
}
