/**
 * The one vocabulary for what a status means, shared by Badge, Alert, StatusPill, Progress, Meter and Toast.
 * `violet` is a decorative category tone (a label, a kind of item), not a status.
 */
const tones = ["neutral", "info", "success", "warning", "destructive", "violet"] as const

type Tone = (typeof tones)[number]

export { tones }
export type { Tone }
