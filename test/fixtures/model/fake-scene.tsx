import type { ModelViewerSceneProps } from "@/components/ui/model-viewer-scene"

/** What the stand-in scene was last rendered with, and how often: jsdom has no WebGL. */
const fakeScene = {
  renders: 0,
  props: undefined as ModelViewerSceneProps | undefined,
  clips: ["Idle", "Wave"],
  record(props: ModelViewerSceneProps) {
    fakeScene.renders += 1
    fakeScene.props = props
  },
}

// Stands in for the three.js scene in jsdom: it reports the model loaded with two clips, as the real one does, and
// renders the scene's children (ModelScan's transition) where a test can stand them in too.
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
