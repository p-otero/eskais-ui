import type { ModelScanStage } from "@/components/ui/model-scan-primitive"

type ModelScanLabels = {
  /** The 3D model's name once it shows, unless `modelAlt` names it. */
  model: string
  /** What each stage is doing: the progress label, and what screen readers hear when it starts. */
  stage: Record<Exclude<ModelScanStage, "photo" | "error">, string>
  /** Under the stage's label while working: `step` of `steps` (4: detecting to ready). */
  step: (step: number, steps: number) => string
  /** The button that starts a run from the photo, with `onStart`. */
  start: string
  cancel: string
  retry: string
  /** Back to the photo, from the finished model or an error, with `onStartOver`. */
  startOver: string
  /** Saves the model, with `onDownload`: an icon button, so this is its name and tooltip. */
  download: string
  /** Plays and pauses the model's clip once it's ready: an icon toggle. */
  play: string
  /** Names the style picker, with `styles`. */
  styles: string
  /** Names the bar of controls over the finished model. */
  toolbar: string
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
  step: (step, steps) => `Step ${String(step)} of ${String(steps)}`,
  start: "Make 3D",
  cancel: "Cancel",
  retry: "Try again",
  startOver: "Start over",
  download: "Download 3D model",
  play: "Play animation",
  styles: "Style",
  toolbar: "3D model controls",
  error: "The 3D model could not be made",
  progress: (percent) => `${String(percent)}%`,
}

export { modelScanLabels }
export type { ModelScanLabels }
