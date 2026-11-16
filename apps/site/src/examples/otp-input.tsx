import { Field, FieldLabel } from "@/components/ui/field"
import { OTPInput, OTPInputGroup, OTPInputSeparator, OTPInputSlot } from "@/components/ui/otp-input"

export default function OTPInputDemo() {
  return (
    <Field>
      <FieldLabel>Verification code</FieldLabel>
      <OTPInput maxLength={6}>
        <OTPInputGroup>
          <OTPInputSlot index={0} />
          <OTPInputSlot index={1} />
          <OTPInputSlot index={2} />
        </OTPInputGroup>
        <OTPInputSeparator />
        <OTPInputGroup>
          <OTPInputSlot index={3} />
          <OTPInputSlot index={4} />
          <OTPInputSlot index={5} />
        </OTPInputGroup>
      </OTPInput>
    </Field>
  )
}
