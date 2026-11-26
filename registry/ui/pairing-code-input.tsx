"use client"

import { useState, type AriaAttributes, type CSSProperties, type ReactNode } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input, type InputProps } from "@/components/ui/input"
import {
  editPairingCode,
  formatPairingCode,
  normalizePairingCode,
  type PairingCodeFormat,
} from "@/components/ui/pairing-code-format"
import { cn } from "@/lib/utils"

type PairingCodeSize = "default" | "lg"

type DataAttributes = { [key: `data-${string}`]: string | number | boolean | undefined }

type PairingCodeInputElementProps = DataAttributes &
  AriaAttributes &
  Pick<InputProps, "id" | "autoFocus" | "inputMode" | "onBlur" | "onFocus" | "onKeyDown">

type PairingCodeInputProps = PairingCodeInputElementProps & {
  /** The field's visible label, which names it for screen readers and agents. */
  label: ReactNode
  /** How many characters a full code has. */
  length: number
  /** The characters a code may hold, in any case; others are dropped as they're typed or pasted. Letters and digits by default. */
  alphabet?: string
  /** Characters per visual group; 4 by default. */
  groupSize?: number
  /** Inserted between groups as the person types; "-" by default. */
  separator?: string
  /** The code, normalized, for a controlled field. */
  value?: string
  defaultValue?: string
  /** Runs with the normalized code, without separators, on every change. */
  onChange?: (code: string) => void
  /** Runs with the normalized code each time an edit makes it full. */
  onComplete?: (code: string) => void
  /** Makes the field read-only and busy, like while the code is looked up. */
  pending?: boolean
  /** Shown in a live alert under the field, which is marked invalid. */
  error?: ReactNode
  description?: ReactNode
  /** Keeps the field from agents: they can't read or type the code. */
  agentHidden?: boolean
  size?: PairingCodeSize
  name?: string
  placeholder?: string
  /** On the field's wrapper, like `style`. */
  className?: string
  style?: CSSProperties
}

function deletionDirection(event: Event | undefined) {
  const inputType = event && "inputType" in event && typeof event.inputType === "string" ? event.inputType : ""
  if (inputType.startsWith("deleteContentBackward") || inputType === "deleteWordBackward") return "backward"
  if (inputType.startsWith("deleteContentForward") || inputType === "deleteWordForward") return "forward"
  return undefined
}

function hasContent(node: ReactNode) {
  return node !== undefined && node !== null && node !== false
}

function PairingCodeInput({
  label,
  length,
  alphabet,
  groupSize = 4,
  separator = "-",
  value,
  defaultValue,
  onChange,
  onComplete,
  pending = false,
  error,
  description,
  agentHidden = false,
  size = "default",
  name,
  placeholder,
  className,
  style,
  inputMode = "text",
  ...inputProps
}: PairingCodeInputProps) {
  const format: PairingCodeFormat = { alphabet, length, groupSize, separator }
  const [ownCode, setOwnCode] = useState(() => normalizePairingCode(defaultValue ?? "", format))
  const code = value === undefined ? ownCode : normalizePairingCode(value, format)
  const formatted = formatPairingCode(code, format)
  const invalid = hasContent(error)

  const change = (next: string) => {
    if (next === code) return
    if (value === undefined) setOwnCode(next)
    onChange?.(next)
    if (next.length === length) onComplete?.(next)
  }

  return (
    <div
      data-slot="pairing-code-input"
      data-agent-hidden={agentHidden ? "" : undefined}
      data-complete={code.length === length ? "" : undefined}
      className={cn("flex min-w-0 flex-col", className)}
      style={style}
    >
      <Field invalid={invalid ? true : undefined}>
        <FieldLabel>{label}</FieldLabel>
        <Input
          {...inputProps}
          name={name}
          value={formatted}
          placeholder={placeholder}
          readOnly={pending}
          aria-busy={pending ? true : undefined}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode={inputMode}
          translate="no"
          className={size === "lg" ? "h-control-lg font-mono text-title tracking-wider" : "font-mono tracking-wider"}
          onValueChange={(text, details) => {
            const field = details.event?.target instanceof HTMLInputElement ? details.event.target : null
            const edit = editPairingCode(
              code,
              text,
              field?.selectionStart ?? text.length,
              format,
              deletionDirection(details.event),
            )
            if (edit.code === code && edit.value === formatted) {
              details.cancel()
              return
            }
            if (field) {
              field.value = edit.value
              field.setSelectionRange(edit.caret, edit.caret)
            }
            change(edit.code)
          }}
        />
        {hasContent(description) ? <FieldDescription>{description}</FieldDescription> : null}
        {invalid ? (
          <FieldError
            match
            render={(props) => (
              <Alert {...props} data-slot="pairing-code-input-error" tone="destructive" live>
                <AlertDescription className="text-foreground">{error}</AlertDescription>
              </Alert>
            )}
          />
        ) : null}
      </Field>
    </div>
  )
}

export { PairingCodeInput }
export type { PairingCodeInputProps, PairingCodeSize }
