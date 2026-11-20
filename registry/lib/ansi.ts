/** A terminal colour: 0 to 255 from the xterm palette (0 to 15 are the named ones), or `#rrggbb` from truecolor. */
type AnsiColor = number | `#${string}`

/** What SGR codes set on a run of text. Only the keys that differ from the default are present. */
type AnsiStyle = {
  fg?: AnsiColor
  bg?: AnsiColor
  bold?: true
  dim?: true
  italic?: true
  underline?: true
  inverse?: true
  strike?: true
}

type AnsiSpan = { text: string; style?: AnsiStyle }

/** A line read from terminal output: its plain text, and its styled runs when it had any SGR codes that apply. */
type AnsiLine = { text: string; spans?: AnsiSpan[] }

const ESC = 0x1b
const BEL = 0x07
const CSI_C1 = 0x9b
const OSC_C1 = 0x9d
const ST_C1 = 0x9c

const isControl = (code: number) =>
  code < 0x20 || code === 0x7f || (code >= 0x80 && code <= 0x9f) || isBidiControl(code)

// Embeddings, overrides and isolates can make a line read differently from what it holds (Trojan Source), and a
// terminal shows them as nothing anyway.
const isBidiControl = (code: number) => (code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069)

const byte = (value: number) => (Number.isInteger(value) && value >= 0 && value <= 255 ? value : undefined)

const hex = (value: number) => value.toString(16).padStart(2, "0")

/** Reads `5;n` or `2;r;g;b` after a 38 or 48, from `params` at `index`. Returns the colour and how many it used. */
function extendedColor(params: readonly number[], index: number): [AnsiColor | undefined, number] {
  const mode = params[index]
  if (mode === 5) return [byte(params[index + 1] ?? Number.NaN), 2]
  if (mode === 2) {
    const [r, g, b] = [params[index + 1], params[index + 2], params[index + 3]].map((value) =>
      byte(value ?? Number.NaN),
    )
    if (r === undefined || g === undefined || b === undefined) return [undefined, 4]
    return [`#${hex(r)}${hex(g)}${hex(b)}`, 4]
  }
  return [undefined, 1]
}

// The colon form keeps a colour in one parameter: 38:5:n, 38:2:r:g:b, or 38:2:<colour space>:r:g:b.
function colonColor(parts: readonly number[]): AnsiColor | undefined {
  if (parts[1] === 5) return byte(parts[2] ?? Number.NaN)
  if (parts[1] !== 2) return undefined
  const channels = parts.length >= 6 ? parts.slice(3, 6) : parts.slice(2, 5)
  const [r, g, b] = channels.map((value) => byte(value))
  if (r === undefined || g === undefined || b === undefined) return undefined
  return `#${hex(r)}${hex(g)}${hex(b)}`
}

function without(style: AnsiStyle, ...keys: (keyof AnsiStyle)[]): AnsiStyle {
  const next = { ...style }
  for (const key of keys) delete next[key]
  return next
}

/** Applies one SGR sequence's parameters, like `1;31` or `38;5;208`, to a style. */
function applySgr(style: AnsiStyle, raw: string): AnsiStyle {
  if (raw === "") return {}
  let next = style
  const groups = raw.split(";")
  const params = groups.map((group) => (group === "" ? 0 : Number(group.split(":")[0])))
  for (let index = 0; index < params.length; index++) {
    const code = params[index] ?? 0
    const group = groups[index] ?? ""
    if (code === 38 || code === 48) {
      const key = code === 38 ? "fg" : "bg"
      if (group.includes(":")) {
        const color = colonColor(group.split(":").map((part) => (part === "" ? Number.NaN : Number(part))))
        next = color === undefined ? next : { ...next, [key]: color }
        continue
      }
      const [color, used] = extendedColor(params, index + 1)
      index += used
      next = color === undefined ? next : { ...next, [key]: color }
      continue
    }
    if (code === 0) next = {}
    else if (code === 1) next = { ...next, bold: true }
    else if (code === 2) next = { ...next, dim: true }
    else if (code === 3) next = { ...next, italic: true }
    else if (code === 4) next = group === "4:0" ? without(next, "underline") : { ...next, underline: true }
    else if (code === 7) next = { ...next, inverse: true }
    else if (code === 9) next = { ...next, strike: true }
    else if (code === 21) next = { ...next, underline: true }
    else if (code === 22) next = without(next, "bold", "dim")
    else if (code === 23) next = without(next, "italic")
    else if (code === 24) next = without(next, "underline")
    else if (code === 27) next = without(next, "inverse")
    else if (code === 29) next = without(next, "strike")
    else if (code >= 30 && code <= 37) next = { ...next, fg: code - 30 }
    else if (code === 39) next = without(next, "fg")
    else if (code >= 40 && code <= 47) next = { ...next, bg: code - 40 }
    else if (code === 49) next = without(next, "bg")
    else if (code >= 90 && code <= 97) next = { ...next, fg: code - 90 + 8 }
    else if (code >= 100 && code <= 107) next = { ...next, bg: code - 100 + 8 }
  }
  return next
}

const styled = (style: AnsiStyle) => Object.keys(style).length > 0

// Where a string terminator ends a control string (OSC, DCS, SOS, PM, APC): BEL, ESC \ or the C1 ST. An
// unterminated one runs to the end of the line, so its payload, like an OSC 8 link target, never shows.
function skipString(raw: string, from: number) {
  for (let index = from; index < raw.length; index++) {
    const code = raw.charCodeAt(index)
    if (code === BEL || code === ST_C1) return index + 1
    if (code === ESC && raw.charCodeAt(index + 1) === 0x5c) return index + 2
  }
  return raw.length
}

/**
 * Reads one line of terminal output: SGR codes (16, 256 and truecolor, bold, dim, italic, underline, inverse,
 * strikethrough, reset) become styled runs, and every other escape sequence, control string and control
 * character is dropped. A carriage return starts the line again, as a progress bar redraws it. The text comes
 * back as plain strings, never markup, so render it as text.
 */
function parseAnsi(raw: string, initial: AnsiStyle = {}): AnsiLine & { style: AnsiStyle } {
  let style = initial
  let spans: AnsiSpan[] = []
  let run = ""
  let anyStyle = styled(style)
  const push = () => {
    if (run === "") return
    const last = spans.at(-1)
    if (last && last.style === (styled(style) ? style : undefined)) last.text += run
    else spans.push(styled(style) ? { text: run, style } : { text: run })
    run = ""
  }
  const setStyle = (next: AnsiStyle) => {
    if (next === style) return
    push()
    style = next
    if (styled(next)) anyStyle = true
  }
  let index = 0
  while (index < raw.length) {
    const code = raw.charCodeAt(index)
    if (code === ESC || code === CSI_C1 || code === OSC_C1) {
      const introducer = code === ESC ? raw.charCodeAt(index + 1) : code === CSI_C1 ? 0x5b : 0x5d
      const start = code === ESC ? index + 2 : index + 1
      if (introducer === 0x5b) {
        let end = start
        while (end < raw.length && raw.charCodeAt(end) >= 0x30 && raw.charCodeAt(end) <= 0x3f) end++
        const paramsEnd = end
        while (end < raw.length && raw.charCodeAt(end) >= 0x20 && raw.charCodeAt(end) <= 0x2f) end++
        const final = raw.charCodeAt(end)
        if (final >= 0x40 && final <= 0x7e) {
          const params = raw.slice(start, paramsEnd)
          if (final === 0x6d && paramsEnd === end && /^[\d;:]*$/.test(params)) setStyle(applySgr(style, params))
          index = end + 1
        } else index = end
        continue
      }
      if (
        introducer === 0x5d ||
        introducer === 0x50 ||
        introducer === 0x58 ||
        introducer === 0x5e ||
        introducer === 0x5f
      ) {
        index = skipString(raw, start)
        continue
      }
      // Any other escape: intermediates, then one final byte.
      let end = index + 1
      while (end < raw.length && raw.charCodeAt(end) >= 0x20 && raw.charCodeAt(end) <= 0x2f) end++
      index = end < raw.length && raw.charCodeAt(end) >= 0x30 && raw.charCodeAt(end) <= 0x7e ? end + 1 : end
      continue
    }
    if (code === 0x0d) {
      // A trailing CR is half of a CRLF; one inside the line returns to its start.
      if (index + 1 < raw.length) {
        run = ""
        spans = []
      }
      index++
      continue
    }
    if (code === 0x09) {
      run += "\t"
      index++
      continue
    }
    if (isControl(code)) {
      index++
      continue
    }
    let end = index + 1
    while (end < raw.length) {
      const next = raw.charCodeAt(end)
      if (next === ESC || next === 0x0d || next === 0x09 || isControl(next)) break
      end++
    }
    run += raw.slice(index, end)
    index = end
  }
  push()
  const text = spans.map((span) => span.text).join("")
  if (!anyStyle || spans.every((span) => !span.style)) return { text, style }
  return { text, spans, style }
}

// oxlint-disable-next-line no-control-regex -- finds the characters parseAnsi drops or acts on
const needsParsing = /[\u0000-\u0008\u000a-\u001f\u007f-\u009f‪-‮⁦-⁩]/

/** Whether a line holds anything `parseAnsi` would drop or act on: plain text needs no parsing. */
function hasAnsi(raw: string) {
  return needsParsing.test(raw)
}

/** The plain text of a line of terminal output, without escape sequences or control characters. */
function stripAnsi(raw: string) {
  return hasAnsi(raw) ? parseAnsi(raw).text : raw
}

const namedColors = [
  "#000000",
  "#cd3131",
  "#0dbc79",
  "#e5e510",
  "#2472c8",
  "#bc3fbc",
  "#11a8cd",
  "#e5e5e5",
  "#666666",
  "#f14c4c",
  "#23d18b",
  "#f5f543",
  "#3b8eea",
  "#d670d6",
  "#29b8db",
  "#ffffff",
] as const

const cubeLevels = [0, 95, 135, 175, 215, 255]

/** The sRGB value of a palette index or truecolor colour, as `#rrggbb`. */
function ansiHex(color: AnsiColor): string {
  if (typeof color === "string") return color
  if (color < 16) return namedColors[color] ?? namedColors[7]
  if (color >= 232) {
    const level = 8 + (color - 232) * 10
    return `#${hex(level)}${hex(level)}${hex(level)}`
  }
  const cube = color - 16
  const r = cubeLevels[Math.floor(cube / 36)] ?? 0
  const g = cubeLevels[Math.floor(cube / 6) % 6] ?? 0
  const b = cubeLevels[cube % 6] ?? 0
  return `#${hex(r)}${hex(g)}${hex(b)}`
}

/**
 * A CSS colour for a terminal colour that holds 4.5:1 on the theme's surfaces: its lightness clamped between
 * the theme's `--ansi-lightness-min` and `--ansi-lightness-max` (dark text in light mode, light text in dark mode),
 * its hue kept, its chroma capped to stay in gamut.
 */
function ansiCssColor(color: AnsiColor) {
  return `oklch(from ${ansiHex(color)} clamp(var(--ansi-lightness-min, 0), l, var(--ansi-lightness-max, 0.48)) min(c, 0.2) h)`
}

export { ansiCssColor, ansiHex, applySgr, hasAnsi, parseAnsi, stripAnsi }
export type { AnsiColor, AnsiLine, AnsiSpan, AnsiStyle }
