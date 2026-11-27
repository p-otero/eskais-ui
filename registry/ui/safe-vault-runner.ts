import { createVaultScene, type VaultState } from "@/components/ui/safe-vault-scene"
import { motionDone } from "@/components/ui/safe-vault-timeline"
import { createStageRunner, serveStageRunner, type RunnerFactory } from "@/lib/three-stage-runner"

const epochNow = () => performance.timeOrigin + performance.now()

/** Draws the safe into `canvas` once per change, and every frame while it unlocks or locks. `null` without WebGL. */
const createSafeVaultRunner: RunnerFactory<VaultState> = (canvas, size, events) =>
  createStageRunner<VaultState>(
    canvas,
    size,
    events,
    (surface, initial) => {
      const scene = createVaultScene(surface, initial)
      return {
        software: scene.software,
        prepare: scene.prepare,
        setSize: scene.setSize,
        animating: (state) => state.moving && !motionDone(state.motion, epochNow()),
        render: (state) => scene.render(state, epochNow()),
        dispose: scene.dispose,
      }
    },
    {
      motion: { kind: "locked", since: 0 },
      dialDegrees: 0,
      numbers: 100,
      plaqueHeight: 18,
      moving: false,
    },
  )

/** Serves the safe's runner to the page from its worker. */
const serveSafeVaultRunner = () => serveStageRunner(createSafeVaultRunner)

export { createSafeVaultRunner, serveSafeVaultRunner }
