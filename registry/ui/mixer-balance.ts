/** Each channel's share, by channel id. */
type MixerValues = Record<string, number>

type Balance = {
  ids: readonly string[]
  values: MixerValues
  locked: ReadonlySet<string>
  total: number
  step: number
}

/** Why a channel can't take a value, or `undefined` when it can. */
type Blocked =
  | { kind: "unknown" }
  | { kind: "locked" }
  | { kind: "range" }
  | { kind: "alone"; held: number }
  | { kind: "over"; held: number; most: number }

const unitsOf = (value: number, step: number) => Math.round(value / step)

const lockedOthers = ({ ids, values, locked }: Balance, id: string) =>
  ids.filter((other) => other !== id && locked.has(other)).reduce((sum, other) => sum + (values[other] ?? 0), 0)

/** The most a channel can take: the total less what the other locked channels hold. */
const ceilingOf = (balance: Balance, id: string) => balance.total - lockedOthers(balance, id)

function blocked(balance: Balance, id: string, value: number): Blocked | undefined {
  if (!balance.ids.includes(id)) return { kind: "unknown" }
  if (!Number.isFinite(value) || value < 0 || value > balance.total) return { kind: "range" }
  const current = balance.values[id] ?? 0
  if (unitsOf(value, balance.step) === unitsOf(current, balance.step)) return undefined
  if (balance.locked.has(id)) return { kind: "locked" }
  const held = lockedOthers(balance, id)
  const free = balance.ids.filter((other) => other !== id && !balance.locked.has(other))
  if (free.length === 0) return { kind: "alone", held }
  if (value > balance.total - held) return { kind: "over", held, most: balance.total - held }
  return undefined
}

function shareUnits(weights: readonly number[], units: number) {
  const sum = weights.reduce((total, weight) => total + weight, 0)
  const exact = weights.map((weight) => (sum > 0 ? (weight / sum) * units : units / weights.length))
  const shares = exact.map(Math.floor)
  let left = units - shares.reduce((total, share) => total + share, 0)
  const byRemainder = exact.map((value, index) => ({ index, remainder: value - Math.floor(value) }))
  byRemainder.sort((a, b) => b.remainder - a.remainder || a.index - b.index)
  for (const { index } of byRemainder) {
    if (left <= 0) break
    shares[index] = (shares[index] ?? 0) + 1
    left--
  }
  return shares
}

/**
 * Sets one channel and moves every unlocked other in proportion to its share, so the values still sum to the total.
 * The value is snapped to the step and clamped to what the locked channels leave; with no free channel to give or
 * take, nothing moves. `weights` are the shares to keep in proportion, the values when a drag began by default, so a
 * channel pushed to the top and back gives every other its share back.
 */
function rebalance(balance: Balance, id: string, value: number, weights: MixerValues = balance.values): MixerValues {
  const { ids, values, locked, step } = balance
  const free = ids.filter((other) => other !== id && !locked.has(other))
  if (locked.has(id) || free.length === 0) return values
  const ceilingUnits = unitsOf(ceilingOf(balance, id), step)
  const ownUnits = Math.max(0, Math.min(ceilingUnits, unitsOf(value, step)))
  const shares = shareUnits(
    free.map((other) => weights[other] ?? 0),
    ceilingUnits - ownUnits,
  )
  const next: MixerValues = { ...values, [id]: ownUnits * step }
  free.forEach((other, index) => {
    next[other] = (shares[index] ?? 0) * step
  })
  for (const other of ids) next[other] = Math.round((next[other] ?? 0) * 1e6) / 1e6
  return next
}

/** Splits the total evenly, in steps, the first channels taking any remainder. */
function evenly(ids: readonly string[], total: number, step: number): MixerValues {
  const shares = shareUnits(
    ids.map(() => 1),
    unitsOf(total, step),
  )
  return Object.fromEntries(ids.map((id, index) => [id, (shares[index] ?? 0) * step]))
}

const sumOf = (ids: readonly string[], values: MixerValues) => ids.reduce((sum, id) => sum + (values[id] ?? 0), 0)

export { blocked, ceilingOf, evenly, rebalance, sumOf, unitsOf }
export type { Balance, Blocked, MixerValues }
