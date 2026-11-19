import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ModelScan } from "@/components/ui/model-scan"
import { Switch } from "@/components/ui/switch"

// A fake engine streams points, a base model, then weights over about three seconds: no ML, and a generated figure.
import figureUrl from "../../../../test/fixtures/model/figure.glb?url"
import portraitUrl from "../../../../test/fixtures/model/portrait.svg?url"
import { useFakeModelScan } from "../../../../test/fixtures/model/use-fake-model-scan"

export default function ModelScanDemo() {
  const { state, start, cancel, fail, setFail } = useFakeModelScan(figureUrl)
  return (
    <div className="flex w-full max-w-sm flex-col gap-group">
      <ModelScan
        src={portraitUrl}
        alt="A front photo of a stylised figure"
        width={600}
        height={800}
        {...state}
        modelAlt="A 3D stylised figure in a teal shirt"
        idleClip="Wave"
        onCancel={state.stage === "photo" ? undefined : cancel}
        onRetry={start}
        actions={
          state.stage === "photo" ? (
            <Button size="sm" onClick={start}>
              Make 3D
            </Button>
          ) : state.stage === "ready" || state.stage === "error" ? (
            <Button variant="ghost" size="sm" onClick={cancel}>
              Start over
            </Button>
          ) : null
        }
      />
      <Label>
        <Switch checked={fail} onCheckedChange={setFail} />
        Fail the next run
      </Label>
    </div>
  )
}
