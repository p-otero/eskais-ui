import type { ModelViewerSceneProps } from "@/components/ui/model-viewer-scene"

const fakeScene = {
  renders: 0,
  props: undefined as ModelViewerSceneProps | undefined,
  clips: ["Idle", "Wave"],
  record(props: ModelViewerSceneProps) {
    fakeScene.renders += 1
    fakeScene.props = props
  },
}

function ModelViewerScene(props: ModelViewerSceneProps) {
  fakeScene.record(props)
  return (
    <span
      data-testid="fake-scene"
      ref={(element) => {
        if (element && props.model !== undefined) props.handle.api.loaded(fakeScene.clips)
      }}
    >
      {props.children}
    </span>
  )
}

export { fakeScene, ModelViewerScene }
