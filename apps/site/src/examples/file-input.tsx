import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { FileUpload } from "@/components/ui/file-input"

export default function FileInputDemo() {
  return (
    <Field className="w-full max-w-md">
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
  )
}
