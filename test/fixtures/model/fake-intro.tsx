import type { ModelScanIntroProps } from "@/components/ui/model-scan-intro"

/** What ModelScan last handed its transition, which in jsdom hands over and finishes as soon as it mounts. */
const fakeIntro = {
  props: undefined as ModelScanIntroProps | undefined,
  record(props: ModelScanIntroProps) {
    fakeIntro.props = props
  },
}

function ModelScanIntro(props: ModelScanIntroProps) {
  fakeIntro.record(props)
  return (
    <span
      data-testid="fake-intro"
      ref={(element) => {
        if (!element) return
        props.onHandOff()
        props.onDone()
      }}
    />
  )
}

export { fakeIntro, ModelScanIntro }
