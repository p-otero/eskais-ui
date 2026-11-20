"use client"

import type { ModelScanMask, ModelScanPersonSource } from "@/components/ui/model-scan-mask"
import { useModelScanIntro } from "@/components/ui/use-model-scan-intro"

type ModelScanIntroProps = {
  src: string
  ratio: number
  fit: "contain" | "cover"
  mask: ModelScanMask | null
  person: ModelScanPersonSource
  onHandOff: () => void
  onDone: () => void
}

/** ModelScan's photo-to-model transition, inside the viewer's canvas; loaded with the scene, only by ModelScan. */
function ModelScanIntro(props: ModelScanIntroProps) {
  const group = useModelScanIntro(props)
  return <primitive object={group} />
}

export { ModelScanIntro }
export type { ModelScanIntroProps }
