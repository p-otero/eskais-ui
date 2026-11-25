"use client"

import { createParts, usePart, usePrimitive, type PartProps } from "@ui-sdk/react/primitive"
import { createContext, use, useId, type ComponentProps, type ReactNode } from "react"
import { ArrowDownIcon } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { conversation, type ConversationOptions } from "@/components/ui/conversation-primitive"
import { RelativeTime } from "@/components/ui/relative-time"
import { ScrollArea, ScrollAreaScrollbar, ScrollAreaViewport } from "@/components/ui/scroll-area"
import type { Instant } from "@/lib/time"
import { cn, cnState } from "@/lib/utils"

const Parts = createParts(conversation, { root: "div", log: "div", newBelow: "button", loadOlder: "button" })

type ConversationApi = ReturnType<typeof usePrimitive<typeof conversation>>["api"]

const ConversationContext = createContext<ConversationApi | null>(null)

/** Null outside a `Conversation`. */
function useConversation() {
  return use(ConversationContext)
}

type ConversationRole = "user" | "assistant" | "agent" | "system" | "tool"

type ConversationLabels = {
  /** The pill's text while messages arrived below: "3 new below". */
  newBelow: (count: number) => string
  /** The pill's text while scrolled up with nothing new. */
  jumpToLatest: string
  loadOlder: string
}

const conversationLabels: ConversationLabels = {
  newBelow: (count) => `${String(count)} new below`,
  jumpToLatest: "Jump to latest",
  loadOlder: "Load older messages",
}

type ConversationRootState = {
  following: boolean
  atBottom: boolean
  newBelow: number
  hasOlder: boolean
  loadingOlder: boolean
}

type ConversationRootProps = PartProps<"div", ConversationRootState> & ConversationOptions

/** Shares its api with `ConversationComposer` and `useConversation`. */
function ConversationRoot({ initial, threshold, hasOlder, onLoadOlder, className, ...props }: ConversationRootProps) {
  const handle = usePrimitive(conversation, { initial, threshold, hasOlder, onLoadOlder })
  const root = usePart(
    handle,
    "root",
    {},
    { ...props, className: cnState("relative flex h-full min-h-0 flex-col", className) },
    "div",
  )
  return <ConversationContext value={handle.api}>{root}</ConversationContext>
}

function ConversationLog({ className, ...props }: ComponentProps<typeof Parts.Log>) {
  return (
    <ScrollArea className="flex min-h-0 flex-1 flex-col">
      <ScrollAreaViewport
        render={(viewport) => (
          <Parts.Log
            {...viewport}
            {...props}
            className={cnState(
              cn(
                viewport.className,
                "flex h-auto min-h-0 flex-1 flex-col gap-group overscroll-contain p-inset-surface",
              ),
              className,
            )}
          />
        )}
      />
      <ScrollAreaScrollbar data-agent-hidden="" />
    </ScrollArea>
  )
}

function ConversationNewBelow({
  className,
  labels: labelsProp,
  children,
  ...props
}: Omit<ComponentProps<typeof Parts.NewBelow>, "children"> & {
  labels?: Partial<Pick<ConversationLabels, "newBelow" | "jumpToLatest">>
  children?: ReactNode
}) {
  const labels = { ...conversationLabels, ...labelsProp }
  return (
    <Parts.NewBelow
      className={cnState(
        cn(
          buttonVariants({ variant: "secondary", size: "sm" }),
          "pointer-events-auto rounded-full border border-floating-border shadow-floating transition duration-micro ease-standard starting:translate-y-1 starting:opacity-0 motion-reduce:starting:translate-y-0",
        ),
        className,
      )}
      {...props}
    >
      {({ newBelow }) => (
        <>
          <ArrowDownIcon />
          {children ?? (newBelow > 0 ? labels.newBelow(newBelow) : labels.jumpToLatest)}
        </>
      )}
    </Parts.NewBelow>
  )
}

function ConversationLoadOlder({ className, children, ...props }: ComponentProps<typeof Parts.LoadOlder>) {
  return (
    <Parts.LoadOlder
      className={cnState(cn(buttonVariants({ variant: "ghost", size: "sm" }), "self-center"), className)}
      {...props}
    >
      {children}
    </Parts.LoadOlder>
  )
}

type ConversationProps = Omit<ConversationRootProps, "children"> & {
  /** Names the log, for screen readers and agents. */
  label: string
  labels?: Partial<ConversationLabels>
  /** A `ConversationComposer`, below the log. */
  composer?: ReactNode
  /** Shown in the log while it has no messages. */
  empty?: ReactNode
  /** `ConversationMessage`s, oldest first. */
  children?: ReactNode
}

/**
 * Follows new messages while the reader is at the end, stops when they scroll up, and offers a "new below" pill that
 * jumps back. A message that grows as it streams keeps the end in view.
 */
function Conversation({ label, labels: labelsProp, composer, empty, children, ...props }: ConversationProps) {
  const labels = { ...conversationLabels, ...labelsProp }
  const hasMessages = Array.isArray(children) ? children.some(Boolean) : Boolean(children)
  return (
    <ConversationRoot {...props}>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <ConversationLog aria-label={label}>
          <ConversationLoadOlder>{labels.loadOlder}</ConversationLoadOlder>
          {hasMessages ? children : empty}
        </ConversationLog>
        <div className="pointer-events-none absolute inset-x-0 bottom-group flex justify-center">
          <ConversationNewBelow labels={labels} />
        </div>
      </div>
      {composer}
    </ConversationRoot>
  )
}

type ConversationMessageLabels = Record<ConversationRole, string>

const conversationMessageLabels: ConversationMessageLabels = {
  user: "You",
  assistant: "Assistant",
  agent: "Agent",
  system: "System",
  tool: "Tool",
}

type ConversationMessageProps = Omit<ComponentProps<"article">, "role"> & {
  /** Who sent it; styles it and becomes `data-from`. */
  from: ConversationRole
  /** The sender's name, shown above the message and naming it. */
  author?: ReactNode
  /** An `Avatar` or `AgentAvatar`, beside the message. */
  avatar?: ReactNode
  /** When it was sent, shown as a `RelativeTime`. */
  time?: Instant
  /** Pass one `useNow()` per screen to every message's `now`. */
  now?: Instant
  locale?: string
  /** Still arriving: `aria-busy`, so screen readers wait for the whole message. */
  streaming?: boolean
  /** Buttons under the message, like Copy or Retry. */
  actions?: ReactNode
  /** Identifies it to agents reading the log. */
  messageId?: string
  /** A screen-reader name per role, used when there is no `author`. */
  labels?: Partial<ConversationMessageLabels>
}

const bubbleClassName =
  "group-data-[from=user]/message:rounded-surface group-data-[from=user]/message:bg-primary group-data-[from=user]/message:px-inset-item group-data-[from=user]/message:py-inset-item group-data-[from=user]/message:text-primary-foreground group-data-[from=tool]/message:rounded-control group-data-[from=tool]/message:border group-data-[from=tool]/message:bg-muted group-data-[from=tool]/message:px-inset-item group-data-[from=tool]/message:py-inset-item group-data-[from=tool]/message:font-mono group-data-[from=tool]/message:text-body-sm"

/** Named by its author and time. */
function ConversationMessage({
  from,
  author,
  avatar,
  time,
  now,
  locale,
  streaming,
  actions,
  messageId,
  labels: labelsProp,
  className,
  children,
  ...props
}: ConversationMessageProps) {
  const headerId = useId()
  const labels = { ...conversationMessageLabels, ...labelsProp }
  return (
    <article
      data-slot="conversation-message"
      data-from={from}
      data-message-id={messageId}
      data-streaming={streaming ? "" : undefined}
      aria-labelledby={headerId}
      aria-busy={streaming || undefined}
      className={cn(
        "group/message flex min-w-0 shrink-0 items-start gap-items text-body data-[from=system]:justify-center data-[from=system]:text-caption data-[from=system]:text-muted-foreground data-[from=user]:flex-row-reverse",
        className,
      )}
      {...props}
    >
      {avatar !== undefined && from !== "system" && (
        <div data-slot="conversation-message-avatar" className="flex shrink-0">
          {avatar}
        </div>
      )}
      <div
        data-slot="conversation-message-body"
        className="flex max-w-full min-w-0 flex-col gap-inline group-data-[from=user]/message:items-end group-data-[from=system]/message:items-center group-data-[from=user]/message:max-w-4/5"
      >
        <div
          id={headerId}
          data-slot="conversation-message-header"
          className="flex items-baseline gap-inline text-caption text-muted-foreground"
        >
          {author === undefined ? (
            <span data-slot="conversation-message-author" className="sr-only">
              {labels[from]}
            </span>
          ) : (
            <span data-slot="conversation-message-author" className="font-medium text-foreground">
              {author}
            </span>
          )}
          {time !== undefined && <RelativeTime value={time} now={now} locale={locale} />}
        </div>
        <div data-slot="conversation-message-content" className={cn("min-w-0 break-words", bubbleClassName)}>
          {children}
        </div>
        {actions !== undefined && (
          <div data-slot="conversation-message-actions" className="flex items-center gap-inline">
            {actions}
          </div>
        )}
      </div>
    </article>
  )
}

export {
  Conversation,
  ConversationContext,
  ConversationLoadOlder,
  ConversationLog,
  ConversationMessage,
  ConversationNewBelow,
  ConversationRoot,
  conversationLabels,
  conversationMessageLabels,
  useConversation,
}
export type {
  ConversationApi,
  ConversationLabels,
  ConversationMessageLabels,
  ConversationMessageProps,
  ConversationProps,
  ConversationRole,
  ConversationRootProps,
}
