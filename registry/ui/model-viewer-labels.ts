import type { ModelViewerView } from "@/components/ui/model-viewer-math"

type ModelViewerLabels = {
  controls: string
  views: string
  view: Record<ModelViewerView, string>
  zoomIn: string
  zoomOut: string
  reset: string
  play: string
  clip: string
  /** Read after the stage's name while it has focus. */
  keyboard: string
  unsupported: string
  error: string
}

const modelViewerLabels: ModelViewerLabels = {
  controls: "3D view controls",
  views: "View",
  view: { front: "Front", "three-quarter": "¾", side: "Side", back: "Back" },
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  reset: "Reset view",
  play: "Play animation",
  clip: "Animation",
  keyboard: "Drag or use the arrow keys to turn, + and - to zoom, Home to reset.",
  unsupported: "3D isn't available in this browser.",
  error: "The 3D model could not be loaded.",
}

export { modelViewerLabels }
export type { ModelViewerLabels }
