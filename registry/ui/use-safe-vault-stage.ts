import { useEffect, useEffectEvent, useRef, type RefObject } from "react"

import {
  createSafeVaultStage,
  supportsSafeVaultStage,
  type SafeVaultStage,
  type VaultInput,
} from "@/components/ui/safe-vault-stage"

/**
 * Puts the 3D safe behind the dial in `host` after the controls have painted, with the plaque in `layer` on its back
 * wall, and hands it each motion. Without WebGL, on the server and in tests, the drawn door stays.
 */
function useSafeVaultStage(
  host: RefObject<HTMLElement | null>,
  layer: RefObject<HTMLElement | null>,
  input: VaultInput & { onRenderer: (webgl: boolean) => void },
) {
  const stage = useRef<SafeVaultStage | null>(null)
  const { motion, numbers, onRenderer } = input
  const rendered = useEffectEvent((webgl: boolean) => onRenderer(webgl))

  useEffect(() => {
    const element = host.current
    const contents = layer.current
    if (!element || !contents || !supportsSafeVaultStage()) return
    const created = createSafeVaultStage(element, {
      layer: contents,
      onRenderer: (webgl) => rendered(webgl),
    })
    stage.current = created
    return () => {
      created.dispose()
      stage.current = null
    }
  }, [host, layer])

  useEffect(() => {
    stage.current?.update({ motion, numbers })
  }, [motion, numbers])
}

export { useSafeVaultStage }
