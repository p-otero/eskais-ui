import { Field, FieldLabel } from "@/components/ui/field"
import { Input, InputClear, InputGroup } from "@/components/ui/input"

export default function InputDemo() {
  return (
    <div className="flex w-full max-w-xs flex-col gap-group">
      <Field>
        <FieldLabel>Project name</FieldLabel>
        <Input defaultValue="Apollo" />
      </Field>
      <Field>
        <FieldLabel>Website</FieldLabel>
        <InputGroup>
          <span className="text-muted-foreground">https://</span>
          <Input defaultValue="eskais.dev" />
          <InputClear aria-label="Clear website" />
        </InputGroup>
      </Field>
    </div>
  )
}
