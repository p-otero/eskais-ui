import figureUrl from "../../../../test/fixtures/model/figure.glb?url"
import portraitUrl from "../../../../test/fixtures/model/portrait.svg?url"

export { figureFace } from "../../../../test/fixtures/model/fake-engine"
export { useFakeModelScan } from "../../../../test/fixtures/model/use-fake-model-scan"

// A stylised figure built in code (tooling/generate-model-fixture.ts) and its front "photo": no real person.
const portrait = { src: portraitUrl, width: 600, height: 800 }

export { figureUrl, portrait }
