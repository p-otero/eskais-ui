import { useSyncExternalStore } from "react"

import type { ModelViewerControlsState, ModelViewerHandle } from "@/components/ui/model-viewer-primitive"

const none = () => () => {}

/** What a control bar shows, from the viewer's state; the same object while none of it changes. */
function controlsOf(handle: ModelViewerHandle, last: ModelViewerControlsState | null): ModelViewerControlsState {
  const state = handle.get()
  const clip = state.clip !== null && state.clips.includes(state.clip) ? state.clip : (state.clips[0] ?? null)
  const playing = state.playing ?? !state.reducedMotion
  if (
    last &&
    last.status === state.status &&
    last.view === state.view &&
    last.clips === state.clips &&
    last.clip === clip &&
    last.playing === playing
  ) {
    return last
  }
  return { status: state.status, view: state.view, clips: state.clips, clip, playing }
}

const cache = new WeakMap<ModelViewerHandle, ModelViewerControlsState>()

function snapshot(handle: ModelViewerHandle | null) {
  if (!handle) return null
  const next = controlsOf(handle, cache.get(handle) ?? null)
  cache.set(handle, next)
  return next
}

/**
 * A viewer's status, view, clips and whether its clip plays, for controls of your own beside a viewer with
 * `controls="gestures"`: pass the handle from `handleRef`, and call `handle.api` from the controls. It renders only
 * when one of those changes, never while the camera turns.
 */
function useModelViewerControls(handle: ModelViewerHandle | null): ModelViewerControlsState | null {
  return useSyncExternalStore(
    handle?.subscribe ?? none,
    () => snapshot(handle),
    () => null,
  )
}

export { useModelViewerControls }
