import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Label } from "@/components/ui/label"
import { Meter, MeterLabel, MeterTrack, MeterValue } from "@/components/ui/meter"
import {
  NumberInput,
  NumberInputControl,
  NumberInputDecrement,
  NumberInputGroup,
  NumberInputIncrement,
} from "@/components/ui/number-input"
import { OTPInput, OTPInputGroup, OTPInputSeparator, OTPInputSlot } from "@/components/ui/otp-input"
import { Progress, ProgressLabel, ProgressTrack, ProgressValue } from "@/components/ui/progress"
import { Radio, RadioGroup, RadioIndicator } from "@/components/ui/radio-group"
import { Slider, SliderControl, SliderIndicator, SliderThumb, SliderTrack, SliderValue } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Toggle } from "@/components/ui/toggle"
import { ToggleGroup } from "@/components/ui/toggle-group"

import { Section } from "../section"

const plans = [
  { value: "hobby", label: "Hobby" },
  { value: "pro", label: "Pro" },
  { value: "team", label: "Team" },
]

const alerts = [
  { tone: "info", title: "Builds are queued", description: "Three builds run ahead of yours." },
  { tone: "success", title: "Deployed", description: "Apollo is live on the production domain." },
  { tone: "warning", title: "Quota almost used", description: "New runs pause when the month's quota runs out." },
  { tone: "destructive", title: "Deploy failed", description: "The build exited with code 1. See the log." },
] as const

function Controls() {
  return (
    <div className="grid w-full gap-6 sm:grid-cols-2">
      <Field>
        <FieldLabel>Plan</FieldLabel>
        <RadioGroup defaultValue="pro">
          {plans.map((plan) => (
            <Label key={plan.value}>
              <Radio value={plan.value}>
                <RadioIndicator />
              </Radio>
              <span>{plan.label}</span>
            </Label>
          ))}
        </RadioGroup>
      </Field>

      <div className="flex flex-col gap-4">
        <Field>
          <Switch defaultChecked />
          <FieldLabel>Email me when a deploy fails</FieldLabel>
        </Field>
        <Field>
          <FieldLabel>Text formatting</FieldLabel>
          <ToggleGroup multiple defaultValue={["bold"]}>
            <Toggle value="bold">Bold</Toggle>
            <Toggle value="italic">Italic</Toggle>
            <Toggle value="code">Code</Toggle>
          </ToggleGroup>
        </Field>
        <Toggle variant="outline" className="w-fit">
          Pin project
        </Toggle>
      </div>

      <Field>
        <Slider defaultValue={[20, 80]} format={{ style: "currency", currency: "USD", maximumFractionDigits: 0 }}>
          <div className="flex justify-between">
            <FieldLabel>Price range</FieldLabel>
            <SliderValue />
          </div>
          <SliderControl>
            <SliderTrack>
              <SliderIndicator />
              <SliderThumb index={0} aria-label="Minimum price" />
              <SliderThumb index={1} aria-label="Maximum price" />
            </SliderTrack>
          </SliderControl>
        </Slider>
      </Field>

      <Field>
        <FieldLabel>Seats</FieldLabel>
        <NumberInput defaultValue={3} min={1} max={50}>
          <NumberInputGroup className="max-w-40">
            <NumberInputDecrement aria-label="Remove a seat" />
            <NumberInputControl />
            <NumberInputIncrement aria-label="Add a seat" />
          </NumberInputGroup>
        </NumberInput>
        <FieldDescription>Between 1 and 50.</FieldDescription>
      </Field>

      <Field>
        <FieldLabel>Verification code</FieldLabel>
        <OTPInput maxLength={6}>
          <OTPInputGroup>
            {[0, 1, 2].map((index) => (
              <OTPInputSlot key={index} index={index} />
            ))}
          </OTPInputGroup>
          <OTPInputSeparator />
          <OTPInputGroup>
            {[3, 4, 5].map((index) => (
              <OTPInputSlot key={index} index={index} />
            ))}
          </OTPInputGroup>
        </OTPInput>
      </Field>

      <div className="flex flex-col gap-4">
        <Progress value={40}>
          <ProgressLabel>Uploading report.pdf</ProgressLabel>
          <ProgressValue />
          <ProgressTrack />
        </Progress>
        <Meter value={68}>
          <MeterLabel>Storage used</MeterLabel>
          <MeterValue />
          <MeterTrack />
        </Meter>
      </div>
    </div>
  )
}

function FormsSection() {
  return (
    <Section
      title="Form controls"
      description="Radio group, switch, slider, toggles, number and code inputs, progress, meter and alerts. Every control is named by its Field label."
    >
      <Controls />
      <div className="grid w-full gap-3 sm:grid-cols-2">
        {alerts.map((alert) => (
          <Alert key={alert.tone} tone={alert.tone}>
            <AlertTitle>{alert.title}</AlertTitle>
            <AlertDescription>{alert.description}</AlertDescription>
          </Alert>
        ))}
      </div>
    </Section>
  )
}

export { FormsSection }
