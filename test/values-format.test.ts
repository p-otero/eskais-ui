import { afterEach, beforeEach, describe, expect, test } from "vitest"

import { formatQuantity } from "@/lib/quantity"
import { formatInstant, formatRelative, toISO } from "@/lib/time"

const usd = (n: number) => `$${n.toFixed(2)}`

describe("formatQuantity", () => {
  test("unknown or missing values read as a dash, never zero", () => {
    for (const quantity of [
      { value: null, quality: "measured" },
      { value: 0, quality: "unknown" },
      { value: Number.NaN, quality: "estimated" },
    ] as const) {
      const formatted = formatQuantity(quantity)
      expect(formatted.text).toBe("—")
      expect(formatted.text).not.toContain("0")
      expect(formatted.srText).toBe("unknown")
      expect(formatted.quality).toBe("unknown")
    }
  })

  test("zero is a real measured value", () => {
    expect(formatQuantity({ value: 0, quality: "measured" })).toEqual({
      text: "0",
      srText: "0",
      title: undefined,
      quality: "measured",
    })
  })

  test("estimated values get a tilde and say so to screen readers", () => {
    expect(formatQuantity({ value: 1234.5, quality: "estimated", source: "tokenizer" }, { locale: "en-US" })).toEqual({
      text: "~1,234.5",
      srText: "1,234.5 (estimated)",
      title: "estimated: tokenizer",
      quality: "estimated",
    })
  })

  test("derived values show the plain number with the source in the title", () => {
    const formatted = formatQuantity({ value: 42, quality: "derived", source: "sum of attempts" })
    expect(formatted.text).toBe("42")
    expect(formatted.title).toBe("derived: sum of attempts")
  })

  test("locale, custom format and labels", () => {
    expect(formatQuantity({ value: 1234.5, quality: "measured" }, { locale: "es-ES" }).text).toBe("1234,5")
    expect(formatQuantity({ value: 12345.5, quality: "measured" }, { locale: "es-ES" }).text).toBe("12.345,5")
    expect(formatQuantity({ value: 0.5, quality: "estimated" }, { format: usd }).text).toBe("~$0.50")
    const es = { estimated: "estimado", unknown: "desconocido", derived: "derivado" }
    expect(formatQuantity({ value: 3, quality: "estimated" }, { labels: es }).srText).toBe("3 (estimado)")
    expect(formatQuantity({ value: null, quality: "unknown" }, { labels: es }).srText).toBe("desconocido")
    expect(formatQuantity({ value: 1, quality: "derived", source: "x" }, { labels: es }).title).toBe("derivado: x")
  })
})

describe("time", () => {
  const now = "2026-11-15T12:00:00Z"
  let originalTimeZone: string | undefined

  beforeEach(() => {
    originalTimeZone = process.env.TZ
    process.env.TZ = "Europe/Madrid"
  })
  afterEach(() => {
    if (originalTimeZone === undefined) delete process.env.TZ
    else process.env.TZ = originalTimeZone
  })

  test("formatRelative picks a sensible unit", () => {
    const cases: [string, string, string][] = [
      ["2026-11-15T11:59:50Z", "10 seconds ago", "hace 10 segundos"],
      ["2026-11-15T11:55:00Z", "5 minutes ago", "hace 5 minutos"],
      ["2026-11-15T09:00:00Z", "3 hours ago", "hace 3 horas"],
      ["2026-11-14T12:00:00Z", "yesterday", "ayer"],
      ["2026-11-01T12:00:00Z", "2 weeks ago", "hace 2 semanas"],
      ["2026-08-15T12:00:00Z", "3 months ago", "hace 3 meses"],
      ["2024-11-15T12:00:00Z", "2 years ago", "hace 2 años"],
      ["2026-11-15T14:00:00Z", "in 2 hours", "dentro de 2 horas"],
    ]
    for (const [value, en, es] of cases) {
      expect(formatRelative(value, { now, locale: "en-US" })).toBe(en)
      expect(formatRelative(value, { now, locale: "es-ES" })).toBe(es)
    }
    expect(formatRelative("2026-11-15T11:59:59.800Z", { now, locale: "en-US" })).toBe("now")
  })

  test("invalid instants read as a dash", () => {
    expect(formatRelative("not a date", { now })).toBe("—")
    expect(formatInstant("not a date")).toBe("—")
    expect(toISO("not a date")).toBeUndefined()
  })

  test("formatInstant appends the zone only when it differs from the browser's", () => {
    expect(formatInstant(now, { locale: "en-US", timeZone: "Europe/Madrid" })).toBe("Nov 15, 2026, 1:00 PM")
    expect(formatInstant(now, { locale: "en-US" })).toBe("Nov 15, 2026, 1:00 PM")
    expect(formatInstant(now, { locale: "en-US", timeZone: "UTC" })).toBe("Nov 15, 2026, 12:00 PM UTC")
    expect(formatInstant(now, { locale: "es-ES", timeZone: "UTC" })).toBe("15 nov 2026, 12:00 UTC")

    process.env.TZ = "UTC"
    expect(formatInstant(now, { locale: "en-US", timeZone: "UTC" })).toBe("Nov 15, 2026, 12:00 PM")
    expect(formatInstant(now, { locale: "es-ES", timeZone: "Europe/Madrid" })).toBe("15 nov 2026, 13:00 CET")
    expect(formatInstant(now, { locale: "en-US", timeZone: "Europe/Madrid" })).toBe("Nov 15, 2026, 1:00 PM GMT+1")
  })
})
