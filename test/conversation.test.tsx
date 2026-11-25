import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { checkServer } from "@ui-sdk/core/testing"
import { createAgent } from "@ui-sdk/react/agent"
import { useState } from "react"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { Conversation, ConversationMessage } from "@/components/ui/conversation"
import { ConversationComposer } from "@/components/ui/conversation-composer"
import { conversation } from "@/components/ui/conversation-primitive"

import { axeViolations } from "./axe"

const agent = createAgent()

type Message = { id: string; from: "user" | "assistant"; text: string }

const initialMessages: Message[] = [
  { id: "m1", from: "user", text: "Can you rename the project?" },
  { id: "m2", from: "assistant", text: "Done: it is now Atlas." },
]

let scrollTo: ReturnType<typeof vi.fn>

beforeEach(() => {
  scrollTo = vi.fn(function (this: HTMLElement, options: ScrollToOptions) {
    this.scrollTop = options.top ?? 0
  })
  Element.prototype.scrollTo = scrollTo as unknown as Element["scrollTo"]
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

// Workaround: jsdom has no layout, so the log gets a scroll height taller than its box, scrolled to `top`.
function layout(log: HTMLElement, { height = 1000, client = 200, top = 800 } = {}) {
  Object.defineProperty(log, "scrollHeight", { configurable: true, get: () => height })
  Object.defineProperty(log, "clientHeight", { configurable: true, get: () => client })
  log.scrollTop = top
}

async function scrollUp(log: HTMLElement) {
  layout(log, { top: 300 })
  log.dispatchEvent(new WheelEvent("wheel", { deltaY: -120 }))
  log.dispatchEvent(new Event("scroll"))
  await flush()
}

function Thread({ onSend }: { onSend?: (text: string) => unknown }) {
  const [messages, setMessages] = useState(initialMessages)
  const add = (from: Message["from"], text: string) =>
    setMessages((current) => [...current, { id: `m${String(current.length + 1)}`, from, text }])
  return (
    <>
      <button type="button" onClick={() => add("assistant", "A new reply.")}>
        Reply
      </button>
      <Conversation
        label="Thread with Atlas"
        composer={
          <ConversationComposer
            onSend={(text) => {
              add("user", text)
              return onSend?.(text)
            }}
          />
        }
      >
        {messages.map((message) => (
          <ConversationMessage
            key={message.id}
            messageId={message.id}
            from={message.from}
            author={message.from === "assistant" ? "Atlas" : undefined}
          >
            {message.text}
          </ConversationMessage>
        ))}
      </Conversation>
    </>
  )
}

test("primitive: renders on the server, following, with no pill", () => {
  checkServer(conversation, {}, `<root><log aria-label="Thread"></log><newBelow></newBelow></root>`)
})

test("server render: a named log of named articles, no pill and no composer state", () => {
  const html = renderToString(
    <Conversation label="Thread">
      <ConversationMessage from="assistant" author="Atlas" time="2026-11-18T10:00:00Z" now="2026-11-18T10:02:00Z">
        Hello
      </ConversationMessage>
    </Conversation>,
  )
  expect(html).toContain('role="log"')
  expect(html).toContain('aria-label="Thread"')
  expect(html).toContain('data-from="assistant"')
  expect(html).not.toContain("Jump to latest")
})

test("a log named by its label holds articles named by their author", async () => {
  const { container } = render(<Thread />)
  const log = screen.getByRole("log", { name: "Thread with Atlas" })
  expect(log.tabIndex).toBe(0)
  expect(screen.getByRole("article", { name: "Atlas" }).textContent).toContain("Atlas")
  expect(screen.getByRole("article", { name: "You" })).toBeTruthy()
  expect(await axeViolations(container)).toEqual([])
})

test("scrolling up stops following and counts new messages below, the pill jumps back", async () => {
  const user = userEvent.setup()
  render(<Thread />)
  await flush()
  const log = screen.getByRole("log", { name: "Thread with Atlas" })
  expect(screen.queryByRole("button", { name: /new below|Jump to latest/ })).toBeNull()

  await scrollUp(log)
  expect(screen.getByRole("button", { name: "Jump to latest" })).toBeTruthy()

  await user.click(screen.getByRole("button", { name: "Reply" }))
  await flush()
  await user.click(screen.getByRole("button", { name: "Reply" }))
  await flush()
  const pill = screen.getByRole("button", { name: "2 new below" })

  pill.focus()
  await user.click(pill)
  await flush()
  expect(scrollTo).toHaveBeenLastCalledWith({ top: 800, behavior: "smooth" })
  expect(screen.queryByRole("button", { name: /new below|Jump to latest/ })).toBeNull()
  expect(document.activeElement).toBe(log)
})

test("under reduced motion the jump is instant", async () => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce") }) as MediaQueryList)
  const user = userEvent.setup()
  render(<Thread />)
  await flush()
  const log = screen.getByRole("log", { name: "Thread with Atlas" })
  await scrollUp(log)
  scrollTo.mockClear()
  await user.click(screen.getByRole("button", { name: "Jump to latest" }))
  expect(scrollTo).not.toHaveBeenCalled()
  expect(log.scrollTop).toBe(800)
})

test("while following, new messages count for nothing", async () => {
  const user = userEvent.setup()
  render(<Thread />)
  await flush()
  await user.click(screen.getByRole("button", { name: "Reply" }))
  await flush()
  expect(screen.queryByRole("button", { name: /new below/ })).toBeNull()
})

test("the composer sends on Enter, keeps Shift+Enter for a line, empties and jumps back", async () => {
  const user = userEvent.setup()
  const onSend = vi.fn()
  render(<Thread onSend={onSend} />)
  await flush()
  const log = screen.getByRole("log", { name: "Thread with Atlas" })
  await scrollUp(log)

  const field = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Message" })
  expect(screen.getByRole("button", { name: "Send" }).hasAttribute("disabled")).toBe(true)
  await user.type(field, "First line{Shift>}{Enter}{/Shift}second")
  expect(field.value).toBe("First line\nsecond")
  await user.keyboard("{Enter}")
  await flush()

  expect(onSend).toHaveBeenCalledWith("First line\nsecond")
  expect(field.value).toBe("")
  expect(screen.getAllByRole("article").at(-1)?.textContent).toContain("second")
  expect(screen.queryByRole("button", { name: /new below|Jump to latest/ })).toBeNull()
})

test("a send that returns false keeps the text", async () => {
  const user = userEvent.setup()
  render(<Thread onSend={() => false} />)
  const field = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Message" })
  await user.type(field, "Retry me{Enter}")
  await flush()
  expect(field.value).toBe("Retry me")
})

test("a streaming message is busy, so screen readers wait for all of it", () => {
  render(
    <Conversation label="Thread">
      <ConversationMessage from="assistant" author="Atlas" streaming>
        Thinking
      </ConversationMessage>
    </Conversation>,
  )
  expect(screen.getByRole("article", { name: "Atlas" }).getAttribute("aria-busy")).toBe("true")
})

function Older() {
  const [messages, setMessages] = useState(["c", "d"])
  return (
    <Conversation
      label="Thread"
      hasOlder={messages.length < 4}
      onLoadOlder={() => setMessages((current) => ["a", "b", ...current])}
    >
      {messages.map((text) => (
        <ConversationMessage key={text} from="assistant" author="Atlas">
          {text}
        </ConversationMessage>
      ))}
    </Conversation>
  )
}

test("older messages load above without counting as new", async () => {
  const user = userEvent.setup()
  render(<Older />)
  await flush()
  await scrollUp(screen.getByRole("log", { name: "Thread" }))
  await user.click(screen.getByRole("button", { name: "Load older messages" }))
  await flush()
  expect(screen.getAllByRole("article").map((article) => article.textContent)).toEqual([
    "Atlasa",
    "Atlasb",
    "Atlasc",
    "Atlasd",
  ])
  expect(screen.queryByRole("button", { name: "Load older messages" })).toBeNull()
  expect(screen.getByRole("button", { name: "Jump to latest" })).toBeTruthy()
})

test("an agent reads the messages, jumps to the latest and sends through the composer", async () => {
  const onSend = vi.fn()
  render(<Thread onSend={onSend} />)
  await flush()
  await scrollUp(screen.getByRole("log", { name: "Thread with Atlas" }))

  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  const thread = components.find((entry) => entry.component === "conversation")
  expect(thread?.label).toBe("Thread with Atlas")
  expect(thread?.actions).toEqual(expect.arrayContaining(["jumpToLatest"]))

  const read = await agent.query({ within: "Thread with Atlas" })
  expect(JSON.stringify(read)).toContain("Atlas: Done: it is now Atlas.")
  expect(JSON.stringify(read)).toContain("You: Can you rename the project?")

  const result = await agent.act({
    steps: [
      { ref: "Thread with Atlas", action: "jumpToLatest" },
      { ref: "Message", action: "setValue", args: ["Thanks"] },
      { ref: "Send", action: "press" },
    ],
  })
  expect(result.ok, result.error?.message).toBe(true)
  await flush()
  expect(onSend).toHaveBeenCalledWith("Thanks")
})
