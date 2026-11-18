import type { PrimitiveInstance } from "@ui-sdk/core"
import { useSyncExternalStore } from "react"

/** A primitive instance's state, re-rendering the component that reads it on every change. */
function useInstanceState<State>(instance: PrimitiveInstance): State {
  return useSyncExternalStore(instance.subscribe, instance.get, instance.get) as State
}

export { useInstanceState }
