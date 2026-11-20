import type { Object3D } from "three"

import figureFinalUrl from "../../../../test/fixtures/model/figure-final.glb?url"
import figureUrl from "../../../../test/fixtures/model/figure.glb?url"
import celUrl from "../../../../test/fixtures/model/character/character-cel-outline.glb?url"
import softUrl from "../../../../test/fixtures/model/character/character-soft-toon.glb?url"
import photoUrl from "../../../../test/fixtures/model/character/photo-body.png?url"
import portraitUrl from "../../../../test/fixtures/model/portrait.svg?url"

export { figureTargetNames } from "../../../../test/fixtures/model/fake-engine"
export type { EngineErrorCode } from "../../../../test/fixtures/model/fake-engine"
export { useFakeModelScan } from "../../../../test/fixtures/model/use-fake-model-scan"
export { useScanReplay } from "../../../../test/fixtures/model/character/use-scan-replay"

// A synthetic person scanned by an open-source photo-to-3D engine (CC0 demo assets, no real person): the character in
// two styles, the full-length photo the scan used, and its recorded events (use-scan-replay).
const character = { soft: softUrl, cel: celUrl }
const photo = { src: photoUrl, width: 540, height: 960 }
// Where the character's head is, in its own units, for a close-up `framing`.
const characterFace = { center: [0, 0.84, 0.04] as [number, number, number], radius: 0.16 }

// Builds the style each material names in `extras.eskais`, before the first frame; loaded with the 3D chunk.
const restyle = async (scene: Object3D) =>
  (await import("../../../../test/fixtures/model/character/style")).styleCharacter(scene)

const characterStyles = [
  { value: "soft", label: "Soft toon" },
  { value: "cel", label: "Cel outline" },
]

// What Download saves in the demos: the character in the chosen style, as the engine would hand it over.
function downloadCharacter(style: keyof typeof character) {
  const link = document.createElement("a")
  link.href = character[style]
  link.download = `character-${style}.glb`
  link.click()
}

// The fake engine's tiny figure, for the error runs the recording doesn't have.
const portrait = { src: portraitUrl, width: 600, height: 800 }
const engineModels = { model: figureUrl, character: figureFinalUrl }

export { character, characterFace, characterStyles, downloadCharacter, engineModels, photo, portrait, restyle }
