import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { PasswordInput } from "@/components/ui/password-input"

export default function PasswordInputDemo() {
  return (
    <Field className="w-full max-w-xs">
      <FieldLabel>Password</FieldLabel>
      <PasswordInput autoComplete="new-password" />
      <FieldDescription>At least 12 characters.</FieldDescription>
    </Field>
  )
}
