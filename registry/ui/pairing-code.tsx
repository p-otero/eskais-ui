"use client"

import { usePart, usePrimitive } from "@ui-sdk/react/primitive"
import { CheckIcon, CircleDashedIcon, CopyIcon, XIcon } from "lucide-react"
import { useState, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { PairingCodeInput, type PairingCodeInputProps, type PairingCodeSize } from "@/components/ui/pairing-code-input"
import {
  comparePairingCodeGroups,
  formatPairingCode,
  normalizePairingCode,
  pairingCodeGroups,
  type PairingCodeGroupMatch,
} from "@/components/ui/pairing-code-format"
import { pairingCode, type PairingCodeCompare, type PairingCodeState } from "@/components/ui/pairing-code-primitive"
import { cn } from "@/lib/utils"

/** Names and announcements for screen readers and agents; English by default. */
type PairingCodeLabels = {
  copy: string
  copied: string
  copiedAnnouncement: string
  /** What a screen reader reads for the code, from its groups: "B C D F, G H J K" by default. */
  spell: (groups: readonly string[]) => string
}

const pairingCodeLabels: PairingCodeLabels = {
  copy: "Copy code",
  copied: "Copied",
  copiedAnnouncement: "Code copied",
  spell: (groups) => groups.map((group) => Array.from(group).join(" ")).join(", "),
}

/** The `confirm` mode's text. None has a default: pass it in the page's language. */
type PairingCodeConfirmText = {
  /** Above the answers, like "Does this code match the one on your device?" */
  prompt?: ReactNode
  matches: ReactNode
  mismatch: ReactNode
}

/** The `enter` mode's text. None has a default: pass it in the page's language. */
type PairingCodeEnterText = {
  /** The field's label, like "Code shown on your device". */
  label: ReactNode
  description?: ReactNode
  /** Shown, and read, once the typed code matches. */
  matches: ReactNode
  /** Shown, and read, while a typed group differs. */
  mismatch: ReactNode
}

type PairingCodeBaseProps = {
  /** The code, with or without separators, in any case. */
  code: string
  /** Names the code for screen readers and agents, like "Pairing code". */
  label: string
  /** Characters per visual group; 4 by default. */
  groupSize?: number
  /** Shown between groups and copied with the code; "-" by default. */
  separator?: string
  size?: PairingCodeSize
  /** Keeps the code from agents: they can't read, copy or compare it, while a person can. */
  agentHidden?: boolean
  /** Runs once the code, with separators, is on the clipboard. */
  onCopy?: (code: string) => void
  labels?: Partial<PairingCodeLabels>
  className?: string
}

type PairingCodeCompareProps =
  | { compare?: undefined; text?: undefined }
  | {
      /** Asks the person whether the code matches the one on the other screen. */
      compare: "confirm"
      text: PairingCodeConfirmText
      onConfirm?: (matches: boolean) => unknown
    }
  | {
      /** Asks the person to type the other screen's code, and checks it group by group as they type. */
      compare: "enter"
      text: PairingCodeEnterText
      /** Runs when the typed code starts or stops matching. */
      onMatchChange?: (matches: boolean) => void
    }

type PairingCodeProps = PairingCodeBaseProps & PairingCodeCompareProps

const rootAttributes = (size: PairingCodeSize): Record<`data-${string}`, string> => ({
  "data-slot": "pairing-code",
  "data-size": size,
})

const valueSize: Record<PairingCodeSize, string> = { default: "text-display-sm", lg: "text-display" }

const groupTone: Record<PairingCodeGroupMatch, string> = {
  match: "border-success-border bg-success-soft text-success-soft-foreground",
  mismatch: "border-destructive-border bg-destructive-soft text-destructive-soft-foreground",
  pending: "border-border text-foreground",
}

const groupIcon: Record<PairingCodeGroupMatch, ReactNode> = {
  match: <CheckIcon strokeWidth={2.5} />,
  mismatch: <XIcon strokeWidth={2.5} />,
  pending: <CircleDashedIcon />,
}

type CodeGroup = { start: number; text: string; match: PairingCodeGroupMatch | undefined }

function hasContent(node: ReactNode) {
  return node !== undefined && node !== null && node !== false
}

function CodeValue({
  groups,
  separator,
  size,
  agentHidden,
  spoken,
}: {
  groups: readonly CodeGroup[]
  separator: string
  size: PairingCodeSize
  agentHidden: boolean
  spoken: string
}) {
  return (
    <span
      data-slot="pairing-code-value"
      data-agent-hidden={agentHidden ? "" : undefined}
      translate="no"
      className={cn("min-w-0 font-mono tracking-wider", valueSize[size])}
    >
      <span aria-hidden="true" className="flex flex-wrap items-center gap-inline">
        {groups.map((group, index) => (
          <span key={group.start} className="flex items-center gap-inline">
            {index > 0 ? (
              <span data-slot="pairing-code-separator" className="text-muted-foreground">
                {separator}
              </span>
            ) : null}
            <span
              data-slot="pairing-code-group"
              data-match={group.match}
              className={cn(
                "flex items-center gap-inline rounded-control",
                group.match === undefined
                  ? undefined
                  : `border px-inset-chip transition-colors duration-micro ease-standard ${groupTone[group.match]}`,
              )}
            >
              {group.text}
              {group.match === undefined ? null : (
                <span data-slot="pairing-code-group-state" className="[&_svg]:size-4">
                  {groupIcon[group.match]}
                </span>
              )}
            </span>
          </span>
        ))}
      </span>
      <span className="sr-only">{spoken}</span>
    </span>
  )
}

function ConfirmAnswers({
  text,
  matches,
  agentHidden,
  onAnswer,
}: {
  text: PairingCodeConfirmText
  matches: boolean | null
  agentHidden: boolean
  onAnswer: (matches: boolean, event: Event) => void
}) {
  return (
    <div
      data-slot="pairing-code-confirm"
      data-agent-hidden={agentHidden ? "" : undefined}
      className="flex flex-col gap-items"
    >
      {hasContent(text.prompt) ? <p className="text-body text-muted-foreground">{text.prompt}</p> : null}
      <div className="flex flex-wrap gap-items narrow:flex-col">
        <Button
          variant={matches === true ? "default" : "outline"}
          onClick={(event) => onAnswer(true, event.nativeEvent)}
        >
          <CheckIcon />
          {text.matches}
        </Button>
        <Button
          variant={matches === false ? "destructive" : "outline"}
          onClick={(event) => onAnswer(false, event.nativeEvent)}
        >
          <XIcon />
          {text.mismatch}
        </Button>
      </div>
    </div>
  )
}

function MatchStatus({ text, matches }: { text: PairingCodeEnterText; matches: boolean | null }) {
  return (
    <output
      data-slot="pairing-code-match"
      data-matches={matches === null ? undefined : String(matches)}
      className="flex min-h-(--type-body-leading) items-center gap-inline text-body data-[matches=false]:text-destructive-soft-foreground data-[matches=true]:text-success-soft-foreground [&_svg]:size-4"
    >
      {matches === true ? (
        <>
          <CheckIcon strokeWidth={2.5} />
          {text.matches}
        </>
      ) : null}
      {matches === false ? (
        <>
          <XIcon strokeWidth={2.5} />
          {text.mismatch}
        </>
      ) : null}
    </output>
  )
}

function enterMatch(groups: readonly PairingCodeGroupMatch[]) {
  if (groups.every((group) => group === "match")) return true
  return groups.includes("mismatch") ? false : null
}

function PairingCode(props: PairingCodeProps) {
  const {
    code: rawCode,
    label,
    groupSize = 4,
    separator = "-",
    size = "default",
    agentHidden = false,
    onCopy,
    labels: overrides,
    className,
  } = props
  const labels = { ...pairingCodeLabels, ...overrides }
  const code = normalizePairingCode(rawCode, {})
  const format = { groupSize, separator }
  const [typed, setTyped] = useState("")
  const groupMatches = props.compare === "enter" ? comparePairingCodeGroups(typed, code, groupSize) : undefined
  const groupTexts = pairingCodeGroups(code, groupSize)
  const groupLength = Math.max(1, Math.floor(groupSize))
  const groups = groupTexts.map((text, index) => ({ start: index * groupLength, text, match: groupMatches?.[index] }))
  const handle = usePrimitive(pairingCode, {
    copyText: formatPairingCode(code, format),
    agentHidden,
    compare: props.compare,
    onCopy,
    onConfirm: props.compare === "confirm" ? props.onConfirm : undefined,
    copiedAnnouncement: labels.copiedAnnouncement,
  })
  const { api } = handle

  const typeCode = (next: string) => {
    setTyped(next)
    if (props.compare !== "enter") return
    const wasMatching = typed === code
    const matching = next === code
    api.setMatches(enterMatch(comparePairingCodeGroups(next, code, groupSize)))
    if (wasMatching !== matching) props.onMatchChange?.(matching)
  }

  return usePart(
    handle,
    "root",
    {},
    {
      ...rootAttributes(size),
      "aria-label": label,
      className: cn("flex min-w-0 flex-col gap-items", className),
      children: (state: PairingCodeState) => (
        <>
          <div className="flex min-w-0 items-center gap-items">
            <CodeValue
              groups={groups}
              separator={separator}
              size={size}
              agentHidden={agentHidden}
              spoken={labels.spell(groupTexts)}
            />
            <span data-agent-hidden={agentHidden ? "" : undefined} className="contents">
              <Button
                size="icon"
                variant="ghost"
                aria-label={state.copied ? labels.copied : labels.copy}
                onClick={(event) => {
                  const copied = api.copy(event.nativeEvent)
                  if (copied) copied.then(undefined, () => undefined)
                }}
              >
                {state.copied ? <CheckIcon /> : <CopyIcon />}
              </Button>
            </span>
          </div>
          {props.compare === "confirm" ? (
            <ConfirmAnswers
              text={props.text}
              matches={state.matches}
              agentHidden={agentHidden}
              onAnswer={(matches, event) => api.confirm(matches, event)}
            />
          ) : null}
          {props.compare === "enter" ? (
            <div data-slot="pairing-code-enter" className="flex flex-col gap-inline">
              <PairingCodeInput
                label={props.text.label}
                description={props.text.description}
                length={code.length}
                groupSize={groupSize}
                separator={separator}
                size={size}
                agentHidden={agentHidden}
                value={typed}
                onChange={typeCode}
              />
              <MatchStatus text={props.text} matches={state.matches} />
            </div>
          ) : null}
        </>
      ),
    },
  )
}

export { PairingCode, PairingCodeInput, pairingCodeLabels }
export type {
  PairingCodeCompare,
  PairingCodeConfirmText,
  PairingCodeEnterText,
  PairingCodeInputProps,
  PairingCodeLabels,
  PairingCodeProps,
  PairingCodeSize,
}
