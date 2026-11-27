import { render, screen } from "@testing-library/react"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, expectTypeOf, test } from "vitest"

import { SecretFingerprint, type SecretFingerprintProps } from "@/components/ui/secret-fingerprint"

import { axeViolations } from "./axe"

test("shows the mask and the fingerprint in a monospace font, and reads the fingerprint in their place", () => {
  render(<SecretFingerprint fingerprint="1a2b" />)
  const fingerprint = document.querySelector<HTMLElement>("[data-slot=secret-fingerprint]")
  expect(fingerprint?.className).toContain("font-mono")
  const [mask, spoken] = [...(fingerprint?.children ?? [])]
  expect(mask?.getAttribute("aria-hidden")).toBe("true")
  expect(mask?.textContent).toBe("•••• 1a2b")
  expect(spoken?.textContent).toBe("Ending in 1a2b")
})

test("without a fingerprint, it shows the mask alone and reads its label", () => {
  render(<SecretFingerprint fingerprint={null} labels={{ none: "Sin huella" }} />)
  const fingerprint = document.querySelector<HTMLElement>("[data-slot=secret-fingerprint]")
  expect(fingerprint?.firstElementChild?.textContent).toBe("••••")
  expect(fingerprint?.lastElementChild?.textContent).toBe("Sin huella")
})

test("labels read the fingerprint in the page's language", () => {
  render(<SecretFingerprint fingerprint="9f3c" labels={{ fingerprint: (last) => `termina en ${last}` }} />)
  expect(screen.getByText("termina en 9f3c")).toBeTruthy()
})

test("its props take only a precomputed fingerprint: there is no value to slice", () => {
  expectTypeOf<SecretFingerprintProps>().not.toHaveProperty("value")
  expectTypeOf<SecretFingerprintProps>().toHaveProperty("fingerprint").toEqualTypeOf<string | null>()
  // @ts-expect-error -- the component never takes the secret itself
  render(<SecretFingerprint fingerprint="1a2b" value="sk-live-123" />)
  expect(document.body.textContent).not.toContain("sk-live-123")
})

test("is plain text: agents read it in the page, and it adds no control", async () => {
  const { container } = render(
    <main>
      <SecretFingerprint fingerprint="1a2b" />
    </main>,
  )
  expect(createAgent().snapshot()).toEqual([])
  expect(await axeViolations(container)).toEqual([])
})
