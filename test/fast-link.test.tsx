import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { describe, expect, test, vi } from "vitest"

import { ButtonLink } from "@/components/ui/button-link"
import { FastLinkRegion } from "@/components/ui/fast-link"
import { Link } from "@/components/ui/link"
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu"

const agent = createAgent()

type Press = { button?: number; pointerType?: string; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }

function press(element: Element, { button = 0, pointerType = "mouse", ...modifiers }: Press = {}) {
  const down = new PointerEvent("pointerdown", { bubbles: true, cancelable: true, button, pointerType, ...modifiers })
  element.dispatchEvent(down)
  const click = new MouseEvent(button === 1 ? "auxclick" : "click", {
    bubbles: true,
    cancelable: true,
    button,
    detail: 1,
    ...modifiers,
  })
  element.dispatchEvent(click)
  return click
}

describe("Link fast navigation", () => {
  test("a primary mouse press follows once; the click after it doesn't follow again", () => {
    const onFollow = vi.fn()
    render(
      <Link href="/next" onFollow={onFollow}>
        Next
      </Link>,
    )
    const anchor = screen.getByRole("link", { name: "Next" })
    anchor.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerType: "mouse" }))
    expect(onFollow).toHaveBeenCalledTimes(1)
    expect(onFollow).toHaveBeenCalledWith("/next", expect.objectContaining({ reason: "follow" }))
    const click = new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 })
    anchor.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(true)
    expect(onFollow).toHaveBeenCalledTimes(1)
  })

  test("without onFollow, the press claims the link and the click's default navigation is prevented", () => {
    render(<Link href="/plain">Plain</Link>)
    // jsdom logs `location.assign` as not implemented; tooling/fast-link-check.mjs covers it in Chrome.
    expect(press(screen.getByRole("link", { name: "Plain" })).defaultPrevented).toBe(true)
  })

  test.each<[string, Press]>([
    ["ctrl", { ctrlKey: true }],
    ["meta", { metaKey: true }],
    ["shift", { shiftKey: true }],
    ["middle button", { button: 1 }],
    ["right button", { button: 2 }],
    ["touch", { pointerType: "touch" }],
    ["pen", { pointerType: "pen" }],
  ])("a %s press stays native", (_name, init) => {
    const onFollow = vi.fn()
    render(
      <Link href="/next" onFollow={onFollow}>
        Next
      </Link>,
    )
    const anchor = screen.getByRole("link", { name: "Next" })
    anchor.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerType: "mouse", ...init }),
    )
    expect(onFollow).not.toHaveBeenCalled()
  })

  test("a touch tap still follows once, on its click", () => {
    const onFollow = vi.fn()
    render(
      <Link href="/next" onFollow={onFollow}>
        Next
      </Link>,
    )
    press(screen.getByRole("link", { name: "Next" }), { pointerType: "touch" })
    expect(onFollow).toHaveBeenCalledTimes(1)
  })

  test.each<[string, Record<string, unknown>]>([
    ["newTab", { newTab: true }],
    ["target=_blank", { target: "_blank" }],
    ["download", { download: "" }],
    ["hash-only", { href: "#section" }],
    ["external", { href: "https://example.com/x", external: true }],
    ["cross-origin", { href: "https://example.com/x" }],
    ["data-no-fast-link", { "data-no-fast-link": "" }],
    ["fast={false}", { fast: false }],
  ])("%s stays native", (_name, props) => {
    const onFollow = vi.fn()
    render(
      <Link href="/next" onFollow={onFollow} {...props}>
        Next
      </Link>,
    )
    const anchor = screen.getByRole("link", { name: /Next/ })
    anchor.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerType: "mouse" }))
    expect(onFollow).not.toHaveBeenCalled()
  })

  test("data-no-fast-link on an ancestor opts a region out", () => {
    const onFollow = vi.fn()
    render(
      <div data-no-fast-link="">
        <p>
          <Link href="/next" onFollow={onFollow}>
            Next
          </Link>
        </p>
      </div>,
    )
    const anchor = screen.getByRole("link", { name: "Next" })
    anchor.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerType: "mouse" }))
    expect(onFollow).not.toHaveBeenCalled()
    const click = new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 })
    anchor.dispatchEvent(click)
    expect(onFollow).toHaveBeenCalledTimes(1)
  })

  test("a rendered router link without onFollow keeps its own click", () => {
    render(
      <Link href="/x" render={<a href="/x" aria-label="Router" />}>
        Router
      </Link>,
    )
    expect(press(screen.getByRole("link", { name: "Router" })).defaultPrevented).toBe(false)
  })

  test("a rendered router link with onFollow follows on press", () => {
    const onFollow = vi.fn()
    render(
      <Link href="/x" onFollow={onFollow} render={<a href="/x" aria-label="Router" />}>
        Router
      </Link>,
    )
    expect(press(screen.getByRole("link", { name: "Router" })).defaultPrevented).toBe(true)
    expect(onFollow).toHaveBeenCalledTimes(1)
  })

  test("keyboard Enter follows once", async () => {
    const onFollow = vi.fn()
    render(
      <Link href="/next" onFollow={onFollow}>
        Next
      </Link>,
    )
    screen.getByRole("link", { name: "Next" }).focus()
    await userEvent.keyboard("{Enter}")
    expect(onFollow).toHaveBeenCalledTimes(1)
  })

  test("the agent's follow action still follows once", async () => {
    const onFollow = vi.fn()
    render(
      <nav aria-label="Main">
        <Link href="/docs" onFollow={onFollow}>
          Documentation
        </Link>
      </nav>,
    )
    const result = await agent.act({ steps: [{ ref: "Documentation", action: "follow" }] })
    expect(result.ok, result.error?.message).toBe(true)
    expect(onFollow).toHaveBeenCalledTimes(1)
    expect(onFollow).toHaveBeenCalledWith("/docs", expect.objectContaining({ source: "agent" }))
  })

  test("ButtonLink follows on press, through Link", () => {
    const onFollow = vi.fn()
    render(
      <ButtonLink href="/start" onFollow={onFollow}>
        Start
      </ButtonLink>,
    )
    expect(press(screen.getByRole("link", { name: "Start" })).defaultPrevented).toBe(true)
    expect(onFollow).toHaveBeenCalledTimes(1)
  })
})

describe("FastLinkRegion", () => {
  test("plain anchors inside follow on press, once, through onFollow", () => {
    const onFollow = vi.fn()
    render(
      <FastLinkRegion onFollow={onFollow}>
        <a href="/a">A</a> <a href="#b">B</a>{" "}
        <a href="/c" data-no-fast-link="">
          C
        </a>
      </FastLinkRegion>,
    )
    expect(press(screen.getByRole("link", { name: "A" })).defaultPrevented).toBe(true)
    expect(onFollow).toHaveBeenCalledTimes(1)
    expect(onFollow).toHaveBeenCalledWith("/a", expect.objectContaining({ url: expect.any(URL) }))
    expect(press(screen.getByRole("link", { name: "B" })).defaultPrevented).toBe(false)
    expect(press(screen.getByRole("link", { name: "C" })).defaultPrevented).toBe(false)
    expect(onFollow).toHaveBeenCalledTimes(1)
  })

  test("a Link inside keeps its own setting", () => {
    const onFollow = vi.fn()
    render(
      <FastLinkRegion onFollow={onFollow}>
        <Link href="/off" fast={false}>
          Off
        </Link>
      </FastLinkRegion>,
    )
    expect(press(screen.getByRole("link", { name: "Off" })).defaultPrevented).toBe(false)
    expect(onFollow).not.toHaveBeenCalled()
  })

  test("enabled={false} leaves presses native", () => {
    const onFollow = vi.fn()
    render(
      <FastLinkRegion enabled={false} onFollow={onFollow}>
        <a href="/a">A</a>
      </FastLinkRegion>,
    )
    expect(press(screen.getByRole("link", { name: "A" })).defaultPrevented).toBe(false)
    expect(onFollow).not.toHaveBeenCalled()
  })
})

describe("NavigationMenuLink", () => {
  test("a plain link is claimed on press; a rendered router link isn't", () => {
    render(
      <NavigationMenu aria-label="Site">
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuLink href="/docs">Docs</NavigationMenuLink>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuLink render={<a href="/blog" aria-label="Blog" />}>Blog</NavigationMenuLink>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuLink href="/off" fast={false}>
              Off
            </NavigationMenuLink>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>,
    )
    expect(press(screen.getByRole("link", { name: "Docs" })).defaultPrevented).toBe(true)
    expect(press(screen.getByRole("link", { name: "Blog" })).defaultPrevented).toBe(false)
    expect(press(screen.getByRole("link", { name: "Off" })).defaultPrevented).toBe(false)
  })
})
