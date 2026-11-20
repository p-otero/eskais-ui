import { use, useEffect } from "react"

import { ModelViewerSceneContext } from "@/components/ui/model-viewer-rig"
import type { ModelRig } from "@/components/ui/model-viewer-rig"

declare global {
  // The rig each probed viewer shows, by name, for tooling/model-check.mjs to read weights, influences and clips.
  var modelProbes: Record<string, ModelRig | null> | undefined
}

/** Puts the viewer's rig on `globalThis.modelProbes[name]` once its model has loaded. */
function useModelProbe(name: string) {
  const rig = use(ModelViewerSceneContext)?.rig ?? null
  useEffect(() => {
    globalThis.modelProbes = { ...globalThis.modelProbes, [name]: rig }
  }, [name, rig])
}

export { useModelProbe }
