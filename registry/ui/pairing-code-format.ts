/** How a pairing code is written: the characters it takes, how many, and how it's grouped. */
type PairingCodeFormat = {
  /** The characters a code may hold, in any case; letters and digits when unset. */
  alphabet?: string
  /** The most characters a code holds; no limit when unset. */
  length?: number
  /** Characters per visual group. */
  groupSize: number
  separator: string
}

type PairingCodeEdit = { value: string; code: string; caret: number }

/** Whether a group of the typed code matches the same group of the expected one, or isn't complete yet. */
type PairingCodeGroupMatch = "match" | "mismatch" | "pending"

const letterOrDigit = /[\p{L}\p{N}]/u

function accepts(alphabet: string | undefined, character: string) {
  return alphabet === undefined ? letterOrDigit.test(character) : alphabet.toUpperCase().includes(character)
}

/** The code's characters in upper case, without separators or anything outside `alphabet`, cut to `length`. */
function normalizePairingCode(text: string, format: Pick<PairingCodeFormat, "alphabet" | "length">) {
  const kept = Array.from(text.toUpperCase()).filter((character) => accepts(format.alphabet, character))
  return (format.length === undefined ? kept : kept.slice(0, format.length)).join("")
}

function pairingCodeGroups(code: string, groupSize: number) {
  const size = Math.max(1, Math.floor(groupSize))
  const groups: string[] = []
  for (let start = 0; start < code.length; start += size) groups.push(code.slice(start, start + size))
  return groups
}

function formatPairingCode(code: string, format: Pick<PairingCodeFormat, "groupSize" | "separator">) {
  return pairingCodeGroups(code, format.groupSize).join(format.separator)
}

/** Where the caret goes in the formatted text, after the first `count` characters of the code. */
function caretAfter(count: number, format: Pick<PairingCodeFormat, "groupSize" | "separator">) {
  if (count <= 0) return 0
  const size = Math.max(1, Math.floor(format.groupSize))
  return count + Math.floor((count - 1) / size) * format.separator.length
}

function keptBefore(text: string, caret: number, format: Pick<PairingCodeFormat, "alphabet">) {
  return Array.from(text.slice(0, caret).toUpperCase()).filter((character) => accepts(format.alphabet, character))
    .length
}

/**
 * Reformats a field after an edit: `previous` is the code before it, `text` and `caret` what the field holds after
 * it. A deletion that only removed a separator removes the character beside it instead, in the edit's direction.
 */
function editPairingCode(
  previous: string,
  text: string,
  caret: number,
  format: PairingCodeFormat,
  direction: "backward" | "forward" | undefined,
): PairingCodeEdit {
  let code = normalizePairingCode(text, format)
  let before = Math.min(keptBefore(text, caret, format), code.length)
  if (code === previous && direction !== undefined) {
    const index = direction === "backward" ? before - 1 : before
    if (index >= 0 && index < code.length) {
      code = code.slice(0, index) + code.slice(index + 1)
      before = index
    }
  }
  return { value: formatPairingCode(code, format), code, caret: caretAfter(before, format) }
}

function comparePairingCodeGroups(typed: string, expected: string, groupSize: number): PairingCodeGroupMatch[] {
  const typedGroups = pairingCodeGroups(typed, groupSize)
  return pairingCodeGroups(expected, groupSize).map((group, index) => {
    const typedGroup = typedGroups[index] ?? ""
    if (typedGroup.length < group.length) return group.startsWith(typedGroup) ? "pending" : "mismatch"
    return typedGroup === group ? "match" : "mismatch"
  })
}

export {
  caretAfter,
  comparePairingCodeGroups,
  editPairingCode,
  formatPairingCode,
  normalizePairingCode,
  pairingCodeGroups,
}
export type { PairingCodeEdit, PairingCodeFormat, PairingCodeGroupMatch }
