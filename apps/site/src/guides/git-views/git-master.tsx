import { GitWorkspaceFrame } from "../../../../showcase/src/sections/git-workspace/frame"
import { GitMasterDemo } from "../../../../showcase/src/sections/git-workspace/git-master"

export default function Demo() {
  return (
    <GitWorkspaceFrame>
      <GitMasterDemo initialRepo="api" />
    </GitWorkspaceFrame>
  )
}
