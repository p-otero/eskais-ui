/** The one vocabulary for what a status means, shared by Badge, Alert, StatusPill, Progress, Meter and Toast. */
const tones = ["neutral", "info", "success", "warning", "destructive"] as const

type Tone = (typeof tones)[number]

export { tones }
export type { Tone }
