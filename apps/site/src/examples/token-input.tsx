import { useState } from "react"

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { TokenInput, TokenInputEditor, type Token } from "@/components/ui/token-input"
import type { Tone } from "@/lib/tone"

const tones: Record<string, Tone> = { bug: "destructive", docs: "info" }

export default function TokenInputDemo() {
  const [labels, setLabels] = useState<readonly string[]>(["bug", "docs"])
  return (
    <Field className="w-full max-w-md">
      <FieldLabel>Labels</FieldLabel>
      <TokenInput
        tokenType="label"
        value={labels}
        onValueChange={setLabels}
        max={5}
        tone={(token: Token) => tones[token.label] ?? "neutral"}
      >
        <TokenInputEditor placeholder="Add a label" />
      </TokenInput>
      <FieldDescription>
        Enter or a comma adds a label; Backspace removes one and Ctrl+Z brings it back.
      </FieldDescription>
    </Field>
  )
}
