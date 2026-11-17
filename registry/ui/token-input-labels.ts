import type { Token, TokenCodec, TokenInputValue } from "@ui-sdk/react/token-input"

/** What a label token input accepts: the type of its tokens, which labels pass, and how many it holds. */
type TokenLabelRules = {
  type: string
  validate?: (label: string) => boolean
  max?: number
}

const separators = /[,\n]/

function labelToken(type: string, label: string): Token {
  return { type, value: label, label, id: `${type}:${label}` }
}

function labelTokens(type: string, labels: readonly string[]): TokenInputValue {
  return labels.map((label) => labelToken(type, label))
}

/** The labels of a value's tokens, in order. */
function tokenLabels(value: readonly (string | Token)[]): string[] {
  return value.flatMap((segment) => (typeof segment === "string" ? [] : [segment.label]))
}

function draftText(value: readonly (string | Token)[]) {
  return value.filter((segment) => typeof segment === "string").join("")
}

function sameLabels(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((label, index) => label === b[index])
}

/**
 * Turns the text before each comma or line break into a label token, or all the text when `commitAll` (Enter, a
 * paste, a controller or an agent). A label that fails `validate` or passes `max` stays as text to fix; a repeated
 * one is dropped. The text after the last separator is the draft being typed and stays as it is.
 */
function settleLabels(value: readonly (string | Token)[], rules: TokenLabelRules, commitAll: boolean) {
  const settled: TokenInputValue = []
  const seen = new Set<string>()
  const max = rules.max ?? Number.POSITIVE_INFINITY
  let text: string[] = []
  const flush = () => {
    if (text.length > 0) settled.push(text.join(", "))
    text = []
  }
  const accept = (raw: string) => {
    const label = raw.trim()
    if (!label || seen.has(label)) return
    if (seen.size >= max || (rules.validate && !rules.validate(label))) {
      text.push(label)
      return
    }
    seen.add(label)
    flush()
    settled.push(labelToken(rules.type, label))
  }
  for (const segment of value) {
    if (typeof segment !== "string") {
      accept(segment.label)
      continue
    }
    const parts = segment.split(separators)
    const draft = commitAll ? "" : (parts.pop() ?? "")
    parts.forEach(accept)
    if (draft) text.push(text.length > 0 ? draft.trimStart() : draft)
  }
  flush()
  return settled
}

/** Writes labels as `bug, ui, ` and reads any comma- or line-separated text back as labels, for copy, paste and forms. */
function labelCodec(type: string): TokenCodec {
  return {
    format: (token) => `${token.label}, `,
    parse: (text) =>
      text
        .split(separators)
        .map((label) => label.trim())
        .filter(Boolean)
        .map((label) => ({ type, value: label, label })),
  }
}

export { draftText, labelCodec, labelToken, labelTokens, sameLabels, settleLabels, tokenLabels }
export type { TokenLabelRules }
