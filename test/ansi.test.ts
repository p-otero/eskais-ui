import { expect, test } from "vitest"

import { ansiCssColor, ansiHex, hasAnsi, parseAnsi, stripAnsi } from "@/lib/ansi"

const ESC = "\u001b"
const CSI = `${ESC}[`

test("plain text needs no parsing and comes back as it is", () => {
  expect(hasAnsi("GET /api/tasks 200 3ms")).toBe(false)
  expect(parseAnsi("GET /api/tasks 200 3ms")).toEqual({ text: "GET /api/tasks 200 3ms", style: {} })
  expect(stripAnsi("tab\tkept")).toBe("tab\tkept")
})

test("SGR codes become styled runs: the 16 colours, bright ones, bold, dim, italic, underline, strike, reset", () => {
  const line = parseAnsi(`${CSI}31mred${CSI}0m plain ${CSI}1;92mbright${CSI}22;39m ${CSI}2;3;4;9mall${CSI}m`)
  expect(line.text).toBe("red plain bright all")
  expect(line.spans).toEqual([
    { text: "red", style: { fg: 1 } },
    { text: " plain " },
    { text: "bright", style: { bold: true, fg: 10 } },
    { text: " " },
    { text: "all", style: { dim: true, italic: true, underline: true, strike: true } },
  ])
})

test("256 colours and truecolor, in the semicolon and the colon forms, foreground and background", () => {
  const line = parseAnsi(`${CSI}38;5;208ma${CSI}48;2;10;20;30mb${CSI}38:2::255:0:128mc${CSI}38:5:21md`)
  expect(line.spans?.map((span) => span.style)).toEqual([
    { fg: 208 },
    { fg: 208, bg: "#0a141e" },
    { fg: "#ff0080", bg: "#0a141e" },
    { fg: 21, bg: "#0a141e" },
  ])
  expect(ansiHex(208)).toBe("#ff8700")
  expect(ansiHex(244)).toBe("#808080")
  expect(ansiHex(1)).toBe("#cd3131")
})

test("out-of-range colours are ignored rather than trusted", () => {
  const line = parseAnsi(`${CSI}38;5;999mx${CSI}38;2;300;0;0my${CSI}48;5mz`)
  expect(line.text).toBe("xyz")
  expect(line.spans).toBeUndefined()
})

test("inverse and its reset, and resets of single attributes", () => {
  const line = parseAnsi(`${CSI}7;33mon${CSI}27moff${CSI}24;23;29m`)
  expect(line.spans).toEqual([
    { text: "on", style: { inverse: true, fg: 3 } },
    { text: "off", style: { fg: 3 } },
  ])
})

test("a style carries in from the previous line and out to the next", () => {
  const first = parseAnsi(`${CSI}32mstarts green`)
  expect(first.style).toEqual({ fg: 2 })
  const second = parseAnsi(`still green${CSI}0m`, first.style)
  expect(second.spans).toEqual([{ text: "still green", style: { fg: 2 } }])
  expect(second.style).toEqual({})
})

test("other escape sequences are dropped: cursor moves, erases, private modes, charsets, keypad", () => {
  const raw = `${CSI}2K${CSI}1G${CSI}?25lclean${CSI}?25h${ESC}(B${ESC}=${ESC}7 text${ESC}8${CSI}3A`
  expect(stripAnsi(raw)).toBe("clean text")
})

test("OSC strings (titles, hyperlinks) are dropped with their payload, terminated by BEL or ST, or not at all", () => {
  expect(stripAnsi(`${ESC}]0;window title\u0007visible`)).toBe("visible")
  expect(stripAnsi(`${ESC}]8;;https://evil.example\u001b\\link${ESC}]8;;${ESC}\\ text`)).toBe("link text")
  expect(stripAnsi(`before${ESC}]8;;javascript:alert(1) never terminated`)).toBe("before")
  expect(stripAnsi(`a${ESC}P1$r0m${ESC}\\b${ESC}_apc\u0007c`)).toBe("abc")
})

test("C1 controls are read like their escape forms", () => {
  expect(parseAnsi("\u009b31mred").spans).toEqual([{ text: "red", style: { fg: 1 } }])
  expect(stripAnsi("\u009d0;title\u009cshown")).toBe("shown")
})

test("control characters and bidi overrides are dropped; a carriage return redraws the line", () => {
  expect(stripAnsi("bell\u0007 null\u0000 del\u007f back\u0008")).toBe("bell null del back")
  expect(stripAnsi("user‮gnp.exe")).toBe("usergnp.exe")
  expect(stripAnsi("10%\r50%\r100%")).toBe("100%")
  expect(stripAnsi("line\r")).toBe("line")
})

test("markup in a line stays text: the parser never builds HTML", () => {
  const raw = `${CSI}31m<img src=x onerror=alert(1)>${CSI}0m<script>alert(2)</script>`
  const line = parseAnsi(raw)
  expect(line.text).toBe("<img src=x onerror=alert(1)><script>alert(2)</script>")
  expect(line.spans?.[0]).toEqual({ text: "<img src=x onerror=alert(1)>", style: { fg: 1 } })
})

test("malformed and truncated sequences don't swallow the text after them or hang", () => {
  expect(stripAnsi(`${ESC}`)).toBe("")
  expect(stripAnsi(`${CSI}`)).toBe("")
  expect(stripAnsi(`${CSI}31`)).toBe("")
  expect(stripAnsi(`a${CSI}31\u0007b`)).toBe("ab")
  expect(stripAnsi(`${CSI}${"9".repeat(500)}mx`)).toBe("x")
  const flood = `${CSI}${"1;".repeat(20_000)}mend`
  const started = performance.now()
  expect(stripAnsi(flood)).toBe("end")
  expect(stripAnsi(`${ESC.repeat(50_000)}[0mtail`)).toBe("tail")
  expect(performance.now() - started).toBeLessThan(500)
})

test("colours map to theme-clamped CSS, never to the raw value alone", () => {
  expect(ansiCssColor(1)).toBe(
    "oklch(from #cd3131 clamp(var(--ansi-lightness-min, 0), l, var(--ansi-lightness-max, 0.48)) min(c, 0.2) h)",
  )
  expect(ansiCssColor("#123456")).toContain("from #123456 clamp(")
})
