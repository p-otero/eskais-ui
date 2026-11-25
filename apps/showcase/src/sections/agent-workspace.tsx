import { useRef, useState } from "react"

import { ActivityLog, undoToast } from "@/components/ui/activity-log"
import { createActivityLog } from "@/components/ui/activity-log-store"
import { AgentTaskBoard } from "@/components/ui/agent-task-board"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Conversation, ConversationMessage } from "@/components/ui/conversation"
import { ConversationComposer } from "@/components/ui/conversation-composer"
import { Field, FieldLabel } from "@/components/ui/field"
import { useNow } from "@/components/ui/relative-time"
import { Switch } from "@/components/ui/switch"
import type { TaskStatus, TaskView } from "@/lib/agent-task-types"

import { sampleStages, sampleTasks } from "../../../../test/fixtures/agent-tasks"
import { agent } from "../agent"
import { Section } from "../section"

const log = createActivityLog(agent, { within: () => document.getElementById("agent-workspace-board") })

type Message = { id: string; from: "user" | "agent" | "system"; text: string; at: number; streaming?: boolean }

const start = Date.now() - 40 * 60_000
const earlier = [
  "Morning. What's left on the docs index?",
  "The indexer finished overnight: 1,204 pages. Two tasks still point at the old schema.",
  "Which ones?",
  "T-012, the migration, and T-013, the backfill that waits on it.",
  "Keep the migration. Is the backfill still needed?",
  "Yes, for attempts that ran before the cost columns existed.",
  "OK. Ping me when the index task is ready for review.",
  "Will do. I'll watch the run and move it when the checks pass.",
]
const seed: Message[] = earlier.map((text, index) => ({
  id: `seed-${String(index)}`,
  from: index % 2 === 0 ? "user" : "agent",
  text,
  at: start + index * 3 * 60_000,
}))

type Turn = { reply: string; act: (move: (id: string, status: TaskStatus) => void) => Promise<string | undefined> }

const turns: Turn[] = [
  {
    reply: "The index checks passed, so I moved T-014 to review.",
    act: async (move) => {
      move("T-014", "review")
      return "Agent moved T-014 to Review"
    },
  },
  {
    reply: "I turned on review notifications, so you hear about the next one.",
    act: async () => {
      await agent.act({ steps: [{ ref: "Notify me when a task needs review", action: "setChecked", args: [true] }] })
      return "Agent turned on review notifications"
    },
  },
  {
    reply: "T-013 waits on the migration, so I cancelled the duplicate T-012 draft. Undo it if you'd rather keep it.",
    act: async (move) => {
      move("T-012", "cancelled")
      return "Agent moved T-012 to Cancelled"
    },
  },
]

function AgentWorkspace() {
  const [messages, setMessages] = useState(seed)
  const [tasks, setTasks] = useState<TaskView[]>(sampleTasks)
  const [turn, setTurn] = useState(0)
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const now = useNow()

  const setStatus = (id: string, status: TaskStatus) =>
    setTasks((list) => list.map((task) => (task.id === id ? { ...task, status } : task)))

  const move = (id: string, status: TaskStatus) => {
    const previous = tasks.find((task) => task.id === id)?.status
    if (!previous) return
    setStatus(id, status)
    log.record({
      label: id,
      description: `Agent moved ${id} to ${status}`,
      actor: "agent",
      previous,
      value: status,
      undo: () => setStatus(id, previous),
      redo: () => setStatus(id, status),
    })
  }

  const stream = (text: string, onDone: () => void) => {
    clearInterval(timer.current)
    const id = `agent-${String(Date.now())}`
    const words = text.split(" ")
    let shown = 0
    setMessages((current) => [...current, { id, from: "agent", text: "", at: Date.now(), streaming: true }])
    timer.current = setInterval(() => {
      shown += 1
      const done = shown >= words.length
      setMessages((current) =>
        current.map((message) =>
          message.id === id ? { ...message, text: words.slice(0, shown).join(" "), streaming: !done } : message,
        ),
      )
      if (done) {
        clearInterval(timer.current)
        onDone()
      }
    }, 60)
  }

  const agentTurn = () => {
    const next = turns[turn % turns.length]
    if (!next) return
    setTurn((current) => current + 1)
    stream(next.reply, () => {
      void next.act(move).then((what) => what && undoToast(what, { log }))
    })
  }

  const send = (text: string) => {
    setMessages((current) => [...current, { id: `user-${String(Date.now())}`, from: "user", text, at: Date.now() }])
    setTimeout(agentTurn, 300)
  }

  return (
    <div className="grid w-full gap-section xl:grid-cols-3">
      <div className="flex h-128 flex-col overflow-hidden rounded-surface border border-border bg-card">
        <Conversation
          label="Thread with the agent"
          composer={<ConversationComposer onSend={send} placeholder="Ask the agent" />}
        >
          {messages.map((message) => (
            <ConversationMessage
              key={message.id}
              messageId={message.id}
              from={message.from}
              author={message.from === "agent" ? "Atlas" : undefined}
              avatar={
                message.from === "agent" ? (
                  <Avatar size="sm">
                    <AvatarFallback>AT</AvatarFallback>
                  </Avatar>
                ) : undefined
              }
              time={message.at}
              now={now}
              streaming={message.streaming}
            >
              {message.text}
            </ConversationMessage>
          ))}
        </Conversation>
      </div>
      <div id="agent-workspace-board" className="flex min-w-0 flex-col gap-items">
        <div className="flex flex-wrap items-center gap-items">
          <Button variant="outline" onClick={agentTurn}>
            Let the agent work
          </Button>
          <Field>
            <Switch />
            <FieldLabel>Notify me when a task needs review</FieldLabel>
          </Field>
        </div>
        <AgentTaskBoard tasks={tasks} stages={sampleStages} mode="snapshot" generatedAt={new Date(now).toISOString()} />
      </div>
      <div className="flex max-h-128 min-h-0 flex-col rounded-surface border border-border bg-card px-inset-item py-inset-item">
        <ActivityLog log={log} label="Activity" header={<h3 className="text-title-sm">Activity</h3>} now={now} />
      </div>
    </div>
  )
}

function AgentWorkspaceSection() {
  return (
    <Section
      title="Conversation and activity log"
      description="An agent thread that follows its newest message and shows a pill when you scroll up, beside a task board; the activity log records the agent's moves and your own changes, with undo, redo, Cmd/Ctrl+Z and jumping back to any point."
    >
      <AgentWorkspace />
    </Section>
  )
}

export { AgentWorkspace, AgentWorkspaceSection }
