import { Field, FieldLabel } from "@/components/ui/field"
import { Rating } from "@/components/ui/rating"

export default function RatingDemo() {
  return (
    <Field className="w-fit">
      <FieldLabel>Your rating</FieldLabel>
      <Rating defaultValue={3.5} step={0.5} deselectable />
    </Field>
  )
}
