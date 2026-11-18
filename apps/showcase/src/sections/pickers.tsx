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
import { PasswordInput } from "@/components/ui/password-input"
import { Rating } from "@/components/ui/rating"
import { DateInput } from "@/components/ui/date-input"
import { ColorPicker } from "@/components/ui/color-picker"
import { ImageCropper } from "@/components/ui/image-cropper"
import { FileInput, FileInputFiles, FileInputTrigger, FileUpload } from "@/components/ui/file-input"

import { Section } from "../section"

const photo = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420"><rect width="640" height="420" fill="#e5e5e5"/><circle cx="460" cy="150" r="56" fill="#fafafa"/><path d="M0 280 120 170l110 100 120-130 130 125 90-60 70 40v175H0z" fill="#a3a3a3"/><path d="M0 330l160-80 120 70 150-80 210 85v95H0z" fill="#525252"/></svg>`,
)}`

const cities = ["Amsterdam", "Athens", "Barcelona", "Berlin", "Boston", "Lisbon", "London", "Madrid", "Paris", "Rome"]

function PickersSection() {
  return (
    <Section
      title="Pickers"
      description="UI SDK's file input (a drop zone, file chips, why files were left out) autocomplete (free text with suggestions) password input, rating, date input, colour picker and image cropper, styled."
    >
      <div data-pickers-demo className="grid w-full gap-section md:grid-cols-2">
        <Field>
          <FieldLabel>Attachments</FieldLabel>
          <FileUpload
            multiple
            accept={["image/*", ".pdf"]}
            maxSize={5_000_000}
            maxFiles={4}
            title="Drop files here"
            description="Images or PDF, up to 5 MB each"
            browseLabel="Browse files"
          />
          <FieldDescription>Up to four files.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel>Résumé</FieldLabel>
          <FileInput accept=".pdf">
            <FileInputTrigger>Choose a PDF</FileInputTrigger>
            <FileInputFiles />
          </FileInput>
        </Field>
        <Field>
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
        </Field>
        <Field>
          <FieldLabel>Password</FieldLabel>
          <PasswordInput autoComplete="new-password" />
          <FieldDescription>At least 12 characters.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel>Your rating</FieldLabel>
          <Rating defaultValue={3.5} step={0.5} deselectable />
        </Field>
        <Field>
          <FieldLabel>Start date</FieldLabel>
          <DateInput defaultValue="2026-11-02" min="2026-01-01" />
        </Field>
        <Field>
          <FieldLabel>Accent colour</FieldLabel>
          <ColorPicker space="oklch" defaultValue="oklch(0.62 0.19 259)" />
        </Field>
        <ImageCropper
          aria-label="Profile photo"
          src={photo}
          alt="Mountains at sunset"
          mode="frame"
          shape="circle"
          aspectRatio={1}
          maxZoom={4}
        />
      </div>
    </Section>
  )
}

export { PickersSection }
