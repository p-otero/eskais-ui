import { use, useEffect } from "react"

import { ModelViewerSceneContext } from "@/components/ui/model-viewer-rig"
import type { ModelRig } from "@/components/ui/model-viewer-rig"

declare global {
  var modelProbes: Record<string, ModelRig | null> | undefined
}

function useModelProbe(name: string) {
  const rig = use(ModelViewerSceneContext)?.rig ?? null
  useEffect(() => {
    globalThis.modelProbes = { ...globalThis.modelProbes, [name]: rig }
  }, [name, rig])
}

export { useModelProbe }
