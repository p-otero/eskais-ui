import { Field, FieldLabel } from "@/components/ui/field"
import { Slider, SliderControl, SliderIndicator, SliderThumb, SliderTrack, SliderValue } from "@/components/ui/slider"

export default function SliderDemo() {
  return (
    <Field className="w-full max-w-sm">
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
  )
}
