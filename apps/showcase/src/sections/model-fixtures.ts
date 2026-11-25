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
const characterFace = { center: [0, 0.84, 0.04] as [number, number, number], radius: 0.16 }

const restyle = async (scene: Object3D) =>
  (await import("../../../../test/fixtures/model/character/style")).styleCharacter(scene)

const characterStyles = [
  { value: "soft", label: "Soft toon" },
  { value: "cel", label: "Cel outline" },
]

function downloadCharacter(style: keyof typeof character) {
  const link = document.createElement("a")
  link.href = character[style]
  link.download = `character-${style}.glb`
  link.click()
}

const portrait = { src: portraitUrl, width: 600, height: 800 }
const engineModels = { model: figureUrl, character: figureFinalUrl }

export { character, characterFace, characterStyles, downloadCharacter, engineModels, photo, portrait, restyle }
