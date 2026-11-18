import { useRef, useState } from "react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Conversation, ConversationMessage } from "@/components/ui/conversation"
import { ConversationComposer } from "@/components/ui/conversation-composer"
import { useNow } from "@/components/ui/relative-time"

type Message = { id: string; from: "user" | "assistant" | "system"; text: string; at: number; streaming?: boolean }

const minutesAgo = (minutes: number) => Date.now() - minutes * 60_000

const seed: Message[] = [
  { id: "m1", from: "system", text: "Atlas joined the thread", at: minutesAgo(30) },
  { id: "m2", from: "user", text: "Can you triage the failing checkout tests?", at: minutesAgo(29) },
  {
    id: "m3",
    from: "assistant",
    text: "Three fail on the coupon step. The fixture expects a 10% discount, the API now returns 12%.",
    at: minutesAgo(28),
  },
  { id: "m4", from: "user", text: "Update the fixture, not the API.", at: minutesAgo(20) },
  { id: "m5", from: "assistant", text: "Done. The fixture now reads 12% and all three pass.", at: minutesAgo(19) },
]

const reply =
  "Here is what changed: the coupon fixture, its snapshot, and a note in the changelog. Scroll up while this arrives and the thread stays where you are."

export default function ConversationDemo() {
  const [messages, setMessages] = useState(seed)
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const now = useNow()

  // Streams a reply a word at a time, so the log has something to follow.
  const streamReply = () => {
    clearInterval(timer.current)
    const id = `m${String(Date.now())}`
    const words = reply.split(" ")
    let shown = 0
    setMessages((current) => [...current, { id, from: "assistant", text: "", at: Date.now(), streaming: true }])
    timer.current = setInterval(() => {
      shown += 1
      const done = shown >= words.length
      if (done) clearInterval(timer.current)
      setMessages((current) =>
        current.map((message) =>
          message.id === id ? { ...message, text: words.slice(0, shown).join(" "), streaming: !done } : message,
        ),
      )
    }, 120)
  }

  const send = (text: string) => {
    setMessages((current) => [...current, { id: `m${String(Date.now())}`, from: "user", text, at: Date.now() }])
    setTimeout(streamReply, 400)
  }

  return (
    <div className="flex w-full flex-col gap-items">
      <div className="h-112 overflow-hidden rounded-surface border border-border bg-card">
        <Conversation
          label="Thread with Atlas"
          composer={<ConversationComposer onSend={send} placeholder="Ask Atlas" />}
        >
          {messages.map((message) => (
            <ConversationMessage
              key={message.id}
              messageId={message.id}
              from={message.from}
              author={message.from === "assistant" ? "Atlas" : undefined}
              avatar={
                message.from === "assistant" ? (
                  <Avatar size="sm">
                    <AvatarFallback>AT</AvatarFallback>
                  </Avatar>
                ) : undefined
              }
              time={message.from === "system" ? undefined : message.at}
              now={now}
              streaming={message.streaming}
            >
              {message.text}
            </ConversationMessage>
          ))}
        </Conversation>
      </div>
      <Button variant="outline" className="self-start" onClick={streamReply}>
        Stream a reply
      </Button>
    </div>
  )
}
