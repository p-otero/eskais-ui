import { definePrimitive } from "@ui-sdk/core"
import type { createOTPInputController } from "@ui-sdk/core/otp-input"

import { settled, unavailable } from "@/lib/action-refusal"

type SafeDialCode = Pick<ReturnType<typeof createOTPInputController>, "getValue" | "setValue">

type SafeDialOptions = {
  code?: SafeDialCode
  /** How many numbers the combination has. */
  length?: number
  /** How many numbers the dial carries, 0 to `numbers − 1`. */
  numbers?: number
  disabled?: boolean
}

/** How many digits each number of the combination takes: two on a dial of 100. */
const digitsPer = (numbers: number) => String(numbers - 1).length

const separators = /[\s,;:./-]+/

/** The code as digits from a string of digits, numbers split by spaces or dashes, or an array of numbers. */
function codeFrom(input: unknown, length: number, numbers: number): string | { why: string } {
  const digits = digitsPer(numbers)
  let parts: string[]
  if (Array.isArray(input)) {
    if (!input.every((part) => typeof part === "number" && Number.isInteger(part))) {
      return { why: "takes whole numbers" }
    }
    parts = input.map((part) => String(part))
  } else if (typeof input === "string" && input.trim() !== "") {
    const trimmed = input.trim()
    parts = separators.test(trimmed)
      ? trimmed.split(separators)
      : (trimmed.match(new RegExp(`.{1,${String(digits)}}`, "g")) ?? [])
  } else return { why: `takes the combination as digits or numbers, not ${JSON.stringify(input)}` }
  if (!parts.every((part) => /^\d+$/.test(part))) return { why: `takes digits only, not ${JSON.stringify(input)}` }
  if (parts.length !== length) {
    return { why: `takes ${String(length)} numbers, not ${String(parts.length)} (${JSON.stringify(input)})` }
  }
  const outside = parts.find((part) => Number(part) >= numbers)
  if (outside !== undefined) return { why: `can't dial ${outside}: the dial runs from 0 to ${String(numbers - 1)}` }
  return parts.map((part) => part.padStart(digits, "0")).join("")
}

/** A combination dial's agent surface: the code is UI SDK's OTP input, a number per turn of the dial. */
const safeDial = definePrimitive({
  name: "safe-dial",
  options: { code: "value", length: "value", numbers: "value", disabled: "value" },
  // Workaround: not `disabled`: the bridge would hide every action from a disabled part without saying why.
  state: (options: SafeDialOptions) => ({ inert: Boolean(options.disabled) }),
  sync: (options) => ({ inert: Boolean(options.disabled) }),
  api: (context) => ({
    /** Enters the whole combination: digits (`"270461"`), numbers split by spaces or dashes, or an array of numbers. */
    enter(code: string | number[], event?: Event) {
      const { code: input, length = 4, numbers = 100, disabled } = context.options()
      if (disabled) return unavailable("enter", "isn't available while the dial is disabled", { event })
      if (!input) return unavailable("enter", "isn't available: the dial isn't ready", { event })
      const digits = codeFrom(code, length, numbers)
      if (typeof digits !== "string") return unavailable("enter", digits.why, { event })
      if (input.getValue() === digits) return true
      return settled(input.setValue(digits, { reason: "imperative", event }), "enter", { event })
    },
  }),
  slots: (slot) => ({
    root: slot({
      role: "group",
      attrs: (state) => ({ "data-disabled": state.inert ? "" : undefined }),
    }),
  }),
  agent: { actions: ["enter"] },
})

export { codeFrom, digitsPer, safeDial }
export type { SafeDialCode, SafeDialOptions }
