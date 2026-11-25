import { definePrimitive } from "@ui-sdk/core"

import { settled, unavailable } from "@/lib/action-refusal"

/** Moves the playhead or starts and stops playback; returns `false` when the app cancelled it. */
type VinylSeek = (seconds: number, event: Event | undefined) => boolean
type VinylPlay = (playing: boolean, event: Event | undefined) => boolean

type VinylScrubberOptions = {
  duration?: number
  playing?: boolean
  disabled?: boolean
  seek?: VinylSeek
  setPlaying?: VinylPlay
}

const clockPattern = /^(?:(\d+):)?(\d{1,2}):(\d{2}(?:\.\d+)?)$/

/** Seconds from a number or a `"m:ss"` / `"h:mm:ss"` string. */
function secondsOf(time: unknown) {
  if (typeof time === "number") return Number.isFinite(time) ? time : undefined
  if (typeof time !== "string") return undefined
  const match = clockPattern.exec(time.trim())
  if (!match) return undefined
  return Number(match[1] ?? 0) * 3600 + Number(match[2]) * 60 + Number(match[3])
}

function ready(options: VinylScrubberOptions, action: string, event: Event | undefined, needsDuration = true) {
  if (options.disabled) return unavailable(action, "isn't available while the player is disabled", { event })
  const { duration, seek, setPlaying } = options
  if (!seek || !setPlaying) return unavailable(action, "isn't available: the player isn't ready", { event })
  if (needsDuration && (!duration || !Number.isFinite(duration))) {
    return unavailable(action, "isn't available until the media's duration is known", { event })
  }
  return { duration: duration ?? 0, seek, setPlaying }
}

/** A media timeline's agent surface: the record is UI SDK's slider in seconds, with playback beside it. */
const vinylScrubber = definePrimitive({
  name: "vinyl-scrubber",
  options: { duration: "value", playing: "value", disabled: "value", seek: "value", setPlaying: "value" },
  // Workaround: not `disabled`: the bridge would hide every action from a disabled part without saying why.
  state: (options: VinylScrubberOptions) => ({ inert: Boolean(options.disabled), playing: Boolean(options.playing) }),
  sync: (options) => ({ inert: Boolean(options.disabled), playing: Boolean(options.playing) }),
  api: (context) => ({
    /** Moves the playhead to a time: seconds, or `"m:ss"`, from 0 to the duration. */
    seek(time: number | string, event?: Event) {
      const player = ready(context.options(), "seek", event)
      if (player === false) return false
      const seconds = secondsOf(time)
      if (seconds === undefined || seconds < 0 || seconds > player.duration) {
        return unavailable(
          "seek",
          `takes 0 to ${String(Math.floor(player.duration))} seconds or "m:ss", not ${JSON.stringify(time)}`,
          { event },
        )
      }
      return settled(player.seek(seconds, event), "seek", { event })
    },
    /** Starts playback; `true` when it already plays. */
    play(event?: Event) {
      const player = ready(context.options(), "play", event)
      if (player === false) return false
      if (context.options().playing) return true
      return settled(player.setPlaying(true, event), "play", { event })
    },
    /** Pauses playback; `true` when it is already paused. */
    pause(event?: Event) {
      const player = ready(context.options(), "pause", event, false)
      if (player === false) return false
      if (!context.options().playing) return true
      return settled(player.setPlaying(false, event), "pause", { event })
    },
  }),
  slots: (slot) => ({
    root: slot({
      role: "group",
      attrs: (state) => ({
        "data-disabled": state.inert ? "" : undefined,
        "data-playing": state.playing ? "" : undefined,
      }),
    }),
  }),
  agent: { actions: ["seek", "play", "pause"] },
})

export { secondsOf, vinylScrubber }
export type { VinylPlay, VinylScrubberOptions, VinylSeek }
