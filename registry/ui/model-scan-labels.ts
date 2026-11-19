import type { ModelScanStage } from "@/components/ui/model-scan-primitive"

type ModelScanLabels = {
  /** The 3D model's name once it shows, unless `modelAlt` names it. */
  model: string
  /** What each stage is doing: the progress bar's label, and what screen readers hear when it starts. */
  stage: Record<Exclude<ModelScanStage, "photo" | "error">, string>
  cancel: string
  retry: string
  error: string
  progress: (percent: number) => string
}

const modelScanLabels: ModelScanLabels = {
  model: "3D model",
  stage: {
    detecting: "Finding points on the photo",
    building: "Building the 3D model",
    refining: "Refining the shape",
    ready: "The 3D model is ready",
  },
  cancel: "Cancel",
  retry: "Try again",
  error: "The 3D model could not be made",
  progress: (percent) => `${String(percent)}%`,
}

export { modelScanLabels }
export type { ModelScanLabels }
