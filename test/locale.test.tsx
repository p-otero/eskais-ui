import { act, render, screen } from "@testing-library/react"
import { afterEach, expect, test } from "vitest"

import { RelativeTime } from "@/components/ui/relative-time"
import { StatDelta, StatValue } from "@/components/ui/stat"
import { pageLocale } from "@/lib/locale"

afterEach(() => {
  document.documentElement.removeAttribute("lang")
})

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

test("formatters follow <html lang> rather than the runtime's default, and follow it as it changes", async () => {
  document.documentElement.lang = "de-DE"
  render(
    <>
      <StatDelta value={0.125} data-testid="delta" />
      <StatValue value={1234.5} data-testid="value" />
    </>,
  )
  await settle()
  expect(screen.getByTestId("delta").textContent).toContain("12,5")
  expect(screen.getByTestId("value").textContent).toBe("1.234,5")

  await act(async () => {
    document.documentElement.lang = "en-US"
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  expect(screen.getByTestId("delta").textContent).toContain("12.5%")
  expect(screen.getByTestId("value").textContent).toBe("1,234.5")
})

test("an explicit locale wins over the page's", async () => {
  document.documentElement.lang = "en-US"
  render(<StatDelta value={0.125} locale="fr-FR" data-testid="delta" />)
  await settle()
  expect(screen.getByTestId("delta").textContent).toContain("12,5")
})

test("RelativeTime reads the page's language", async () => {
  document.documentElement.lang = "es-ES"
  render(<RelativeTime value="2026-01-01T00:00:00Z" now="2026-01-01T00:05:00Z" />)
  await settle()
  expect(screen.getByText(/hace 5 minutos/)).toBeTruthy()
})

test("pageLocale is undefined without a lang", () => {
  expect(pageLocale()).toBeUndefined()
})
