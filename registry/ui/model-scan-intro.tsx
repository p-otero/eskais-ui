"use client"

import { useModelScanIntro } from "@/components/ui/use-model-scan-intro"

type ModelScanIntroProps = {
  src: string
  ratio: number
  fit: "contain" | "cover"
  onHandOff: () => void
  onDone: () => void
}

/** ModelScan's photo-to-model transition, inside the viewer's canvas; loaded with the scene, only by ModelScan. */
function ModelScanIntro(props: ModelScanIntroProps) {
  const dissolve = useModelScanIntro(props)
  if (!dissolve) return null
  return (
    <>
      <primitive object={dissolve.plane} />
      <primitive object={dissolve.particles} />
    </>
  )
}

export { ModelScanIntro }
export type { ModelScanIntroProps }
