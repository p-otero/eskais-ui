import {
  Autocomplete,
  AutocompleteClear,
  AutocompleteContent,
  AutocompleteControl,
  AutocompleteEmpty,
  AutocompleteInput,
  AutocompleteList,
} from "@/components/ui/autocomplete"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"

const cities = ["Amsterdam", "Athens", "Barcelona", "Berlin", "Boston", "Lisbon", "London", "Madrid", "Paris", "Rome"]

export default function AutocompleteDemo() {
  return (
    <Field className="w-full max-w-xs">
      <FieldLabel>City</FieldLabel>
      <Autocomplete items={cities} autoHighlight>
        <AutocompleteControl>
          <AutocompleteInput placeholder="e.g. Lisbon" />
          <AutocompleteClear />
        </AutocompleteControl>
        <AutocompleteContent>
          <AutocompleteEmpty>Any city works, even one not listed.</AutocompleteEmpty>
          <AutocompleteList />
        </AutocompleteContent>
      </Autocomplete>
      <FieldDescription>Suggestions help; any text is valid.</FieldDescription>
    </Field>
  )
}
