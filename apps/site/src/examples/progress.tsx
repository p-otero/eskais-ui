import { Progress, ProgressLabel, ProgressTrack, ProgressValue } from "@/components/ui/progress"

export default function ProgressDemo() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-group">
      <Progress value={40}>
        <ProgressLabel>Uploading report.pdf</ProgressLabel>
        <ProgressValue />
        <ProgressTrack />
      </Progress>
      <Progress value={100} tone="success">
        <ProgressLabel>Indexing done</ProgressLabel>
        <ProgressValue />
        <ProgressTrack />
      </Progress>
    </div>
  )
}
