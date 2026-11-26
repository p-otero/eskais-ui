"use client"

import {
  TokenInput as TokenInputPrimitive,
  TokenInputEditor as TokenInputEditorPrimitive,
  TokenInputToken as TokenInputTokenPrimitive,
  TokenInputTokenRemove as TokenInputTokenRemovePrimitive,
  createTokenInputController,
  type Token,
  type TokenInputController,
  type TokenInputProps as TokenInputPrimitiveProps,
  type TokenInputSubmitDetails,
  type TokenInputValue,
  type TokenInputValueChangeDetails,
} from "@ui-sdk/react/token-input"
import { XIcon } from "lucide-react"
import { createContext, useContext, useMemo, useState, type ComponentProps, type FocusEventHandler } from "react"

import { badgeVariants } from "@/components/ui/badge"
import { fieldSurfaceClassName, floatingLabelControls, formControlAdapters } from "@/components/ui/field"
import {
  draftText,
  labelCodec,
  labelTokens,
  sameLabels,
  settleLabels,
  tokenLabels,
  type TokenLabelRules,
} from "@/components/ui/token-input-labels"
import type { Tone } from "@/lib/tone"
import { cn, cnState } from "@/lib/utils"

type TokenInputLabels = {
  /** Names a token's remove button for pointer users (it is hidden from assistive technology: Backspace removes). */
  remove: (label: string) => string
}

const defaultLabels: TokenInputLabels = { remove: (label) => `Remove ${label}` }

type TokenTone = Tone | ((token: Token) => Tone)

const TokenInputContext = createContext<{ labels: TokenInputLabels; tone: TokenTone }>({
  labels: defaultLabels,
  tone: "neutral",
})
const TokenLabelContext = createContext("")

type SharedProps = Omit<TokenInputPrimitiveProps, "value" | "defaultValue" | "onValueChange"> & {
  className?: string
  onBlur?: FocusEventHandler<HTMLDivElement>
  /** The chips' tone, or a function of each token; `neutral` by default. */
  tone?: TokenTone
  labels?: Partial<TokenInputLabels>
}

type TokenInputTextProps = SharedProps & {
  tokenType?: undefined
  value?: readonly (string | Token)[]
  defaultValue?: readonly (string | Token)[]
  onValueChange?: (value: TokenInputValue, details: TokenInputValueChangeDetails) => void
}

type TokenInputLabelProps = SharedProps & {
  /**
   * Makes it a list of labels, each a token of this type: Enter or a comma turns the typed text into one, and pasted
   * text splits on commas and line breaks. The value is the labels.
   */
  tokenType: string
  value?: readonly string[]
  defaultValue?: readonly string[]
  onValueChange?: (labels: string[], details: TokenInputValueChangeDetails) => void
  /** Whether a label may become a token; one that can't stays as text to fix. */
  validate?: (label: string) => boolean
  /** The most labels it holds; text typed past it stays as text. */
  max?: number
}

type TokenInputProps = TokenInputTextProps | TokenInputLabelProps

function renderDefaultToken(token: Token) {
  return (
    <TokenInputToken>
      {token.label}
      <TokenInputTokenRemove />
    </TokenInputToken>
  )
}

type FrameProps = Omit<SharedProps, "controller"> & {
  controller: TokenInputController
  value?: TokenInputValue
  defaultValue?: TokenInputValue
  onValueChange?: (value: TokenInputValue, details: TokenInputValueChangeDetails) => void
}

function TokenInputFrame({
  className,
  onBlur,
  tone = "neutral",
  labels,
  renderToken,
  children,
  ...options
}: FrameProps) {
  const context = useMemo(() => ({ labels: { ...defaultLabels, ...labels }, tone }), [labels, tone])
  return (
    <TokenInputContext value={context}>
      <div
        data-slot="token-input"
        className={cn(
          // oxlint-disable-next-line shadcn/no-arbitrary-values -- the field grows with its tokens, so the pill radius stops at half a one-line field
          `${fieldSurfaceClassName} flex min-h-field-control w-full min-w-0 cursor-text items-start rounded-[min(var(--control-radius),var(--control-height)/2)] px-control-x py-control-inset text-entry`,
          // oxlint-disable-next-line shadcn/no-arbitrary-values -- a label inside the field floats in the room above the first line
          "in-data-[label-placement=in]:pt-[calc(var(--field-label-offset)+var(--spacing-control-inset))]",
          // oxlint-disable-next-line shadcn/no-arbitrary-values -- a label on the border reaches half its line into the field, so the first row of chips starts below it
          "in-data-[label-placement=on]:pt-[calc(var(--type-caption-leading)/2)]",
          "has-aria-invalid:border-destructive has-data-disabled:cursor-not-allowed has-data-disabled:opacity-50 has-[[data-slot=token-input-editor]:focus-visible]:ring-2 has-[[data-slot=token-input-editor]:focus-visible]:ring-ring",
          className,
        )}
        onBlur={onBlur}
        onPointerDown={(event) => {
          if (event.target !== event.currentTarget) return
          event.preventDefault()
          options.controller.focus({ at: "end" })
        }}
      >
        <TokenInputPrimitive renderToken={renderToken ?? renderDefaultToken} {...options}>
          {children ?? <TokenInputEditor />}
        </TokenInputPrimitive>
      </div>
    </TokenInputContext>
  )
}

function LabelTokenInput({
  tokenType,
  value,
  defaultValue,
  onValueChange,
  validate,
  max,
  onSubmit,
  codec,
  controller,
  ...props
}: Omit<TokenInputLabelProps, "controller"> & { controller: TokenInputController }) {
  const rules: TokenLabelRules = { type: tokenType, validate, max }
  const [segments, setSegments] = useState(() => labelTokens(tokenType, value ?? defaultValue ?? []))
  const [applied, setApplied] = useState(value)
  if (value !== undefined && value !== applied) {
    setApplied(value)
    if (!sameLabels(tokenLabels(segments), value)) setSegments([...labelTokens(tokenType, value), draftText(segments)])
  }
  const [initialCodec] = useState(() => labelCodec(tokenType))

  const change = (next: TokenInputValue, details: TokenInputValueChangeDetails) => {
    const commitAll = details.reason === "paste" || details.reason === "drop" || details.reason === "imperative"
    const settled = settleLabels(next, rules, commitAll)
    const labels = tokenLabels(settled)
    if (!sameLabels(labels, tokenLabels(segments))) onValueChange?.(labels, details)
    if (!details.canceled) setSegments(settled)
  }
  const submit = (current: TokenInputValue, details: TokenInputSubmitDetails) => {
    if (draftText(current).trim()) controller.setValue(settleLabels(current, rules, true))
    else onSubmit?.(current, details)
  }
  return (
    <TokenInputFrame
      {...props}
      controller={controller}
      codec={codec ?? initialCodec}
      value={segments}
      onValueChange={change}
      onSubmit={submit}
    />
  )
}

/**
 * A text field that holds tokens, like people, files or tags, on UI SDK's token input: each token moves, deletes and
 * copies as one piece, with undo. With `tokenType` it holds labels instead.
 */
function TokenInput(props: TokenInputProps) {
  const [ownController] = useState(createTokenInputController)
  const controller = props.controller ?? ownController
  if (props.tokenType !== undefined) return <LabelTokenInput {...props} controller={controller} />
  return <TextTokenInput {...props} controller={controller} />
}

function TextTokenInput({
  value,
  defaultValue,
  tokenType: _tokenType,
  ...props
}: Omit<TokenInputTextProps, "controller"> & { controller: TokenInputController }) {
  const ownValue = useMemo(() => (value === undefined ? undefined : [...value]), [value])
  const [initial] = useState(() => (defaultValue === undefined ? undefined : [...defaultValue]))
  return <TokenInputFrame {...props} value={ownValue} defaultValue={initial} />
}

function TokenInputEditor({ className, ...props }: ComponentProps<typeof TokenInputEditorPrimitive>) {
  return (
    <TokenInputEditorPrimitive
      className={cnState(
        [
          "min-h-[1lh] min-w-0 flex-1 leading-[calc(var(--control-height)-2*var(--spacing-control-inset)-2px)] break-words outline-none",
          "data-empty:before:pointer-events-none data-empty:before:text-muted-foreground data-empty:before:content-[attr(aria-placeholder)]",
          "in-data-[label-placement=in]:[&:not(:focus)]:before:text-transparent",
        ].join(" "),
        className,
      )}
      {...props}
    />
  )
}

type TokenInputTokenProps = ComponentProps<typeof TokenInputTokenPrimitive> & {
  /** The chip's tone; the TokenInput's `tone` by default. */
  tone?: Tone
}

function TokenInputToken({ className, tone, children, ...props }: TokenInputTokenProps) {
  const context = useContext(TokenInputContext)
  return (
    <TokenInputTokenPrimitive
      className={(state) => {
        const resolved = tone ?? (typeof context.tone === "function" ? context.tone(state.token) : context.tone)
        return cn(
          badgeVariants({ variant: null, tone: resolved }),
          "me-inline align-middle select-none data-pending:opacity-60 data-selected:ring-2 data-selected:ring-ring data-unresolved:border-dashed",
          typeof className === "function" ? className(state) : className,
        )
      }}
      {...props}
    >
      {(state) => (
        <TokenLabelContext value={state.token.label}>
          {typeof children === "function" ? children(state) : children}
        </TokenLabelContext>
      )}
    </TokenInputTokenPrimitive>
  )
}

function TokenInputTokenRemove({
  className,
  children,
  title,
  ...props
}: ComponentProps<typeof TokenInputTokenRemovePrimitive>) {
  const { labels } = useContext(TokenInputContext)
  const label = useContext(TokenLabelContext)
  return (
    <TokenInputTokenRemovePrimitive
      title={title ?? labels.remove(label)}
      className={cnState(
        "touch-target inline-flex size-3.5 shrink-0 cursor-pointer items-center justify-center rounded-full opacity-70 hover:opacity-100 data-disabled:hidden data-readonly:hidden [&>svg]:size-3",
        className,
      )}
      {...props}
    >
      {children ?? <XIcon strokeWidth={2.5} />}
    </TokenInputTokenRemovePrimitive>
  )
}

floatingLabelControls.add(TokenInput)
formControlAdapters.set(TokenInput, {
  value: "value",
  change: "onValueChange",
  toControl: (value) => value ?? [],
  blur: true,
})

export {
  TokenInput,
  TokenInputEditor,
  TokenInputToken,
  TokenInputTokenRemove,
  createTokenInputController,
  labelCodec,
  tokenLabels,
}
export type { TokenInputLabels, TokenInputLabelProps, TokenInputProps, TokenInputTextProps, TokenInputTokenProps }
export type {
  Token,
  TokenCodec,
  TokenInputController,
  TokenInputValue,
  TokenInputValueChangeDetails,
} from "@ui-sdk/react/token-input"
