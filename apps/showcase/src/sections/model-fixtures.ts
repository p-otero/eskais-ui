import figureFinalUrl from "../../../../test/fixtures/model/figure-final.glb?url"
import figureUrl from "../../../../test/fixtures/model/figure.glb?url"
import portraitTallUrl from "../../../../test/fixtures/model/portrait-tall.svg?url"
import portraitUrl from "../../../../test/fixtures/model/portrait.svg?url"

export { figureFace, figureTargetNames } from "../../../../test/fixtures/model/fake-engine"
export type { EngineErrorCode } from "../../../../test/fixtures/model/fake-engine"
export { useFakeModelScan } from "../../../../test/fixtures/model/use-fake-model-scan"

// A stylised figure built in code (tooling/generate-model-fixture.ts) and its front "photo": no real person.
const portrait = { src: portraitUrl, width: 600, height: 800 }
// The same figure in a 9:16 photo, as a phone takes it.
const tallPortrait = { src: portraitTallUrl, width: 450, height: 800 }

// What the fake engine sends: the base model with `model`, the final character with `done`.
const engineModels = { model: figureUrl, character: figureFinalUrl }

export { engineModels, figureFinalUrl, figureUrl, portrait, tallPortrait }
