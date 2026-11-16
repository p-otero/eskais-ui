import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export default function FieldDemo() {
  return (
    <Field className="w-full max-w-xs">
      <FieldLabel>Email</FieldLabel>
      <Input type="email" required placeholder="ada@example.com" />
      <FieldDescription>We only use it for deploy alerts.</FieldDescription>
      <FieldError match="valueMissing">Enter your email address.</FieldError>
      <FieldError match="typeMismatch">Enter an address like ada@example.com.</FieldError>
    </Field>
  )
}
