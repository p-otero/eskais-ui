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

  test("a link with its own onClick keeps the click, so a router's handler still runs and decides", () => {
    const seen: boolean[] = []
    const onClick = vi.fn((event: { defaultPrevented: boolean; preventDefault(): void }) => {
      seen.push(event.defaultPrevented)
      event.preventDefault()
    })
    render(
      <Link href="/routed" onClick={onClick}>
        Routed
      </Link>,
    )
    const click = press(screen.getByRole("link", { name: "Routed" }))
    expect(seen).toEqual([false])
    expect(click.defaultPrevented).toBe(true)
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

const pressOnly = (element: Element, pointerType = "mouse") =>
  element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerType }))
const resetHash = () => history.replaceState(null, "", location.pathname)

describe("hash routes", () => {
  test("a #/ link follows once on press, through onFollow, and the click after it doesn't follow again", () => {
    const onFollow = vi.fn()
    render(
      <Link href="#/inbox" onFollow={onFollow}>
        Inbox
      </Link>,
    )
    expect(press(screen.getByRole("link", { name: "Inbox" })).defaultPrevented).toBe(true)
    expect(onFollow).toHaveBeenCalledTimes(1)
    expect(onFollow).toHaveBeenCalledWith("#/inbox", expect.objectContaining({ reason: "follow" }))
  })

  test("without onFollow, the press sets location.hash", () => {
    resetHash()
    render(<Link href="#/inbox/42">Message</Link>)
    pressOnly(screen.getByRole("link", { name: "Message" }))
    expect(location.hash).toBe("#/inbox/42")
    resetHash()
  })

  test("an in-page anchor stays native: no press navigation, the click jumps", () => {
    resetHash()
    const onFollow = vi.fn()
    render(
      <>
        <Link href="#section">Section</Link>
        <FastLinkRegion onFollow={onFollow}>
          <a href="#notes">Notes</a>
        </FastLinkRegion>
      </>,
    )
    pressOnly(screen.getByRole("link", { name: "Section" }))
    pressOnly(screen.getByRole("link", { name: "Notes" }))
    expect(location.hash).toBe("")
    expect(press(screen.getByRole("link", { name: "Notes" })).defaultPrevented).toBe(false)
    expect(onFollow).not.toHaveBeenCalled()
  })

  test.each(["touch", "data-no-fast-link"])("a %s press on a hash route stays native", (name) => {
    resetHash()
    render(
      <div data-no-fast-link={name === "data-no-fast-link" ? "" : undefined}>
        <Link href="#/inbox">Inbox</Link>
      </div>,
    )
    pressOnly(screen.getByRole("link", { name: "Inbox" }), name === "touch" ? "touch" : "mouse")
    expect(location.hash).toBe("")
  })

  test("ButtonLink and NavigationMenuLink follow hash routes on press", () => {
    resetHash()
    render(
      <>
        <ButtonLink href="#/start">Start</ButtonLink>
        <NavigationMenu aria-label="Site">
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuLink href="#/docs">Docs</NavigationMenuLink>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      </>,
    )
    pressOnly(screen.getByRole("link", { name: "Start" }))
    expect(location.hash).toBe("#/start")
    pressOnly(screen.getByRole("link", { name: "Docs" }))
    expect(location.hash).toBe("#/docs")
    resetHash()
  })

  test("FastLinkRegion follows #/ anchors once; a Link inside keeps its own navigation", () => {
    resetHash()
    const onFollow = vi.fn()
    render(
      <FastLinkRegion onFollow={onFollow}>
        <a href="#/a">A</a> <Link href="#/b">B</Link>
      </FastLinkRegion>,
    )
    expect(press(screen.getByRole("link", { name: "A" })).defaultPrevented).toBe(true)
    expect(onFollow).toHaveBeenCalledTimes(1)
    expect(onFollow).toHaveBeenCalledWith("#/a", expect.objectContaining({ url: expect.any(URL) }))
    pressOnly(screen.getByRole("link", { name: "B" }))
    expect(onFollow).toHaveBeenCalledTimes(1)
    expect(location.hash).toBe("#/b")
    resetHash()
  })

  test("hashPrefix sets what counts as a route, for Links inside too; false makes every # href an anchor", () => {
    const onFollow = vi.fn()
    render(
      <>
        <FastLinkRegion hashPrefix="#!/" onFollow={onFollow}>
          <a href="#!/bang">Bang</a> <a href="#/slash">Slash</a>{" "}
          <Link href="#!/inner" onFollow={onFollow}>
            Inner
          </Link>
        </FastLinkRegion>
        <FastLinkRegion hashPrefix={false} onFollow={onFollow}>
          <a href="#/off">Off</a>
        </FastLinkRegion>
      </>,
    )
    pressOnly(screen.getByRole("link", { name: "Bang" }))
    pressOnly(screen.getByRole("link", { name: "Slash" }))
    pressOnly(screen.getByRole("link", { name: "Inner" }))
    pressOnly(screen.getByRole("link", { name: "Off" }))
    expect(onFollow.mock.calls.map(([href]) => href as string)).toEqual(["#!/bang", "#!/inner"])
  })

  test("data-fast-link-hash-prefix on an ancestor configures every link inside", () => {
    const onFollow = vi.fn()
    render(
      <div data-fast-link-hash-prefix="#!">
        <Link href="#!home" onFollow={onFollow}>
          Home
        </Link>
      </div>,
    )
    pressOnly(screen.getByRole("link", { name: "Home" }))
    expect(onFollow).toHaveBeenCalledWith("#!home", expect.anything())
  })

  test("with a <base> elsewhere, #/ is another document's URL and stays native", () => {
    const base = document.createElement("base")
    base.href = "https://example.com/app/"
    document.head.append(base)
    const onFollow = vi.fn()
    render(
      <Link href="#/inbox" onFollow={onFollow}>
        Inbox
      </Link>,
    )
    pressOnly(screen.getByRole("link", { name: "Inbox" }))
    base.remove()
    expect(onFollow).not.toHaveBeenCalled()
  })
})
