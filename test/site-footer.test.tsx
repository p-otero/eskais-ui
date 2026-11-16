import { render, screen, within } from "@testing-library/react"
import { expect, test } from "vitest"

import { SiteFooter } from "@/components/ui/site-footer"

import { axeViolations } from "./axe"

test("SiteFooter groups links in named navigation landmarks", async () => {
  const { container } = render(
    <SiteFooter
      brand="Acme"
      description="Desc"
      groups={[{ title: "Docs", links: [{ label: "Install", href: "/install" }] }]}
      bottom="MIT"
    />,
  )
  const nav = screen.getByRole("navigation", { name: "Docs" })
  expect(within(nav).getByRole("link", { name: "Install" }).getAttribute("data-variant")).toBe("muted")
  expect(await axeViolations(container)).toEqual([])
})
