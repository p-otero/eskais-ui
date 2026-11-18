"use client"

import { useState, type FormEvent, type ReactNode } from "react"
import { ArrowUpIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useConversation } from "@/components/ui/conversation"
import { Textarea, createInputController, type InputController } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type ConversationComposerLabels = {
  /** Names the text field. */
  message: string
  /** Names the send button. */
  send: string
}

const conversationComposerLabels: ConversationComposerLabels = { message: "Message", send: "Send" }

type ConversationComposerProps = {
  /**
   * Sends the trimmed text. The field empties once it returns, or once a returned Promise resolves; return `false`
   * (or resolve to it) to keep the text, like after a failed send.
   */
  onSend: (text: string) => unknown
  labels?: Partial<ConversationComposerLabels>
  placeholder?: string
  disabled?: boolean
  /** `"enter"` (default): Enter sends and Shift+Enter starts a line. `"mod+enter"`: Cmd/Ctrl+Enter sends. */
  submitShortcut?: "enter" | "mod+enter"
  /** Reads and writes the field from outside, like a suggestion chip that fills it. */
  controller?: InputController
  /** More controls beside Send, like an attach button. */
  actions?: ReactNode
  className?: string
}

/** A message field and a Send button under a `Conversation`: sending jumps the log to the newest message. */
function ConversationComposer({
  onSend,
  labels: labelsProp,
  placeholder,
  disabled,
  submitShortcut = "enter",
  controller,
  actions,
  className,
}: ConversationComposerProps) {
  const labels = { ...conversationComposerLabels, ...labelsProp }
  const [ownController] = useState(createInputController)
  const input = controller ?? ownController
  const [hasText, setHasText] = useState(false)
  const [pending, setPending] = useState(false)
  const conversation = useConversation()

  const send = async () => {
    const text = input.getValue().trim()
    if (!text || disabled || pending) return
    conversation?.jumpToLatest()
    setPending(true)
    const sent = await Promise.resolve(onSend(text)).then(
      (result) => result !== false,
      () => false,
    )
    setPending(false)
    if (sent) input.clear()
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void send()
  }

  return (
    <form
      data-slot="conversation-composer"
      onSubmit={submit}
      className={cn(
        "flex items-end gap-items border-t border-border bg-background/(--glass-opacity) px-inset-surface py-group",
        className,
      )}
    >
      <Textarea
        controller={input}
        aria-label={labels.message}
        placeholder={placeholder}
        disabled={disabled}
        autoResize
        submitShortcut={submitShortcut}
        rows={1}
        onValueChange={(value: string) => setHasText(value.trim() !== "")}
        className="max-h-40 min-h-control resize-none"
      />
      {actions}
      <Button
        type="submit"
        size="icon"
        aria-label={labels.send}
        loading={pending}
        disabled={disabled || !hasText}
        className="rounded-full"
      >
        <ArrowUpIcon />
      </Button>
    </form>
  )
}

export { ConversationComposer, conversationComposerLabels }
export type { ConversationComposerLabels, ConversationComposerProps }
