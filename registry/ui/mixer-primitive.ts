import { definePrimitive } from "@ui-sdk/core"

import { blocked, rebalance, sumOf, unitsOf, type Balance, type MixerValues } from "@/components/ui/mixer-balance"
import { settled, unavailable } from "@/lib/action-refusal"

type MixerChannelInfo = { id: string; label: string }

/** What a change asks of the app: it returns `false` when the app cancelled it. */
type MixerCommit = (values: MixerValues, change: { channel: string | undefined; event: Event | undefined }) => boolean
type MixerLockCommit = (id: string, locked: boolean, event: Event | undefined) => boolean

type MixerOptions = {
  channels?: readonly MixerChannelInfo[]
  values?: MixerValues
  locked?: readonly string[]
  total?: number
  step?: number
  disabled?: boolean
  commit?: MixerCommit
  commitLock?: MixerLockCommit
}

type Ready = {
  balance: Balance
  channels: readonly MixerChannelInfo[]
  commit: MixerCommit
  commitLock: MixerLockCommit
}

function ready(options: MixerOptions, action: string, event: Event | undefined): Ready | false {
  if (options.disabled) return unavailable(action, "isn't available while the mixer is disabled", { event })
  const { channels, values, commit, commitLock } = options
  if (!channels || !values || !commit || !commitLock)
    return unavailable(action, "isn't available: the mixer isn't ready", { event })
  const balance = {
    ids: channels.map((channel) => channel.id),
    values,
    locked: new Set(options.locked),
    total: options.total ?? 100,
    step: options.step ?? 1,
  }
  return { balance, channels, commit, commitLock }
}

const nameOf = (channels: readonly MixerChannelInfo[], id: string) =>
  channels.find((channel) => channel.id === id)?.label ?? id

const known = (channels: readonly MixerChannelInfo[]) =>
  channels.map((channel) => JSON.stringify(channel.id)).join(", ")

function valuesFrom(input: unknown, channels: readonly MixerChannelInfo[]): MixerValues | undefined {
  if (Array.isArray(input)) {
    if (input.length !== channels.length || !input.every((value) => typeof value === "number")) return undefined
    return Object.fromEntries(channels.map((channel, index) => [channel.id, Number(input[index])]))
  }
  if (typeof input !== "object" || input === null) return undefined
  const entries = Object.entries(input)
  if (!entries.every(([, value]) => typeof value === "number")) return undefined
  return Object.fromEntries(entries.map(([id, value]) => [id, Number(value)]))
}

/** A mixer's agent surface: channel shares that always sum to the total, where locked channels stay put. */
const mixer = definePrimitive({
  name: "mixer",
  options: {
    channels: "value",
    values: "value",
    locked: "value",
    total: "value",
    step: "value",
    disabled: "value",
    commit: "value",
    commitLock: "value",
  },
  // Workaround: not `disabled`: the bridge would hide every action from a disabled part without saying why.
  state: (options: MixerOptions) => ({ inert: Boolean(options.disabled) }),
  sync: (options) => ({ inert: Boolean(options.disabled) }),
  api: (context) => ({
    /** Sets one channel by id and rebalances the unlocked others in proportion, so the total holds. */
    setChannel(id: string, value: number, event?: Event) {
      const mixerReady = ready(context.options(), "setChannel", event)
      if (mixerReady === false) return false
      const { balance, channels, commit } = mixerReady
      const name = nameOf(channels, id)
      const why = blocked(balance, id, value)
      if (why?.kind === "unknown")
        return unavailable("setChannel", `has no channel ${JSON.stringify(id)}; the channels are ${known(channels)}`, {
          event,
        })
      if (why?.kind === "range")
        return unavailable("setChannel", `takes 0 to ${String(balance.total)}, not ${String(value)}`, { event })
      if (why?.kind === "locked") return unavailable("setChannel", `can't move ${name}: it is locked`, { event })
      if (why?.kind === "alone") {
        return unavailable(
          "setChannel",
          `can't move ${name}: every other channel is locked, so nothing can make up the difference`,
          { event },
        )
      }
      if (why?.kind === "over") {
        return unavailable(
          "setChannel",
          `can't set ${name} to ${String(value)}: locked channels hold ${String(why.held)} of ${String(balance.total)}, so it can take at most ${String(why.most)}`,
          { event },
        )
      }
      if (unitsOf(value, balance.step) === unitsOf(balance.values[id] ?? 0, balance.step)) return true
      return settled(commit(rebalance(balance, id, value), { channel: id, event }), "setChannel", { event })
    },
    /** Sets every channel at once, by id or in order; they must sum to the total and keep locked channels as they are. */
    setAll(values: MixerValues | number[], event?: Event) {
      const mixerReady = ready(context.options(), "setAll", event)
      if (mixerReady === false) return false
      const { balance, channels, commit } = mixerReady
      const next = valuesFrom(values, channels)
      if (!next) {
        return unavailable(
          "setAll",
          `takes one number per channel, in order or by id (${known(channels)}), not ${JSON.stringify(values)}`,
          { event },
        )
      }
      const missing = balance.ids.filter((id) => !(id in next))
      if (missing.length > 0)
        return unavailable("setAll", `is missing ${missing.map((id) => nameOf(channels, id)).join(", ")}`, { event })
      const stranger = Object.keys(next).find((id) => !balance.ids.includes(id))
      if (stranger !== undefined)
        return unavailable(
          "setAll",
          `has no channel ${JSON.stringify(stranger)}; the channels are ${known(channels)}`,
          { event },
        )
      const outside = balance.ids.find((id) => (next[id] ?? 0) < 0 || (next[id] ?? 0) > balance.total)
      if (outside !== undefined)
        return unavailable(
          "setAll",
          `takes 0 to ${String(balance.total)} per channel, not ${String(next[outside])} for ${nameOf(channels, outside)}`,
          { event },
        )
      const sum = sumOf(balance.ids, next)
      if (unitsOf(sum, balance.step) !== unitsOf(balance.total, balance.step))
        return unavailable("setAll", `needs values that sum to ${String(balance.total)}, not ${String(sum)}`, { event })
      const moved = balance.ids.find(
        (id) =>
          balance.locked.has(id) &&
          unitsOf(next[id] ?? 0, balance.step) !== unitsOf(balance.values[id] ?? 0, balance.step),
      )
      if (moved !== undefined) {
        return unavailable(
          "setAll",
          `can't move ${nameOf(channels, moved)}: it is locked at ${String(balance.values[moved])}`,
          { event },
        )
      }
      const snapped = Object.fromEntries(
        balance.ids.map((id) => [id, unitsOf(next[id] ?? 0, balance.step) * balance.step]),
      )
      if (balance.ids.every((id) => snapped[id] === balance.values[id])) return true
      return settled(commit(snapped, { channel: undefined, event }), "setAll", { event })
    },
    /** Locks a channel so rebalancing leaves it put, or unlocks it with `false`. */
    lock(id: string, locked = true, event?: Event) {
      const mixerReady = ready(context.options(), "lock", event)
      if (mixerReady === false) return false
      const { balance, channels, commitLock } = mixerReady
      if (!balance.ids.includes(id))
        return unavailable("lock", `has no channel ${JSON.stringify(id)}; the channels are ${known(channels)}`, {
          event,
        })
      if (balance.locked.has(id) === locked) return true
      return settled(commitLock(id, locked, event), "lock", { event })
    },
  }),
  slots: (slot) => ({
    root: slot({
      role: "group",
      attrs: (state) => ({ "data-disabled": state.inert ? "" : undefined }),
    }),
  }),
  agent: { actions: ["setChannel", "setAll", "lock"] },
})

export { mixer }
export type { MixerChannelInfo, MixerCommit, MixerLockCommit, MixerOptions }
