"use client"

import {
  FileInput as FileInputPrimitive,
  FileInputDropzone as FileInputDropzonePrimitive,
  FileInputItem as FileInputItemPrimitive,
  FileInputItemRemove as FileInputItemRemovePrimitive,
  FileInputList as FileInputListPrimitive,
  FileInputTrigger as FileInputTriggerPrimitive,
  formatFileSize,
  type FileRejection,
} from "@ui-sdk/react/file-input"
import { useState, type ComponentProps, type ReactNode } from "react"
import { CircleAlertIcon, UploadIcon, XIcon } from "lucide-react"

import { AttachmentThumb } from "@/components/ui/attachment-thumb"
import { buttonVariants } from "@/components/ui/button"
import { ControlTooltip, type ControlTooltipOption } from "@/components/ui/tooltip"
import { useLocale } from "@/lib/locale"
import { cn, cnState } from "@/lib/utils"

type FileLimits = { maxSize?: number; minSize?: number; maxFiles?: number }

type FileInputLabels = {
  /** Names the list of chosen files. */
  list: string
  /** Names a file's remove button, and its tooltip. */
  remove: (name: string) => string
  /** Says why a file was left out, from its first reason (`file-type`, `file-too-large`… or your `validate`'s). */
  rejected: (rejection: FileRejection, limits: FileLimits & { locale: string | undefined }) => string
}

const fileInputLabels: FileInputLabels = {
  list: "Files",
  remove: (name) => `Remove ${name}`,
  rejected: ({ file, reasons }, { maxSize, minSize, maxFiles, locale }) => {
    const [reason] = reasons
    if (reason === "file-type") return `${file.name} isn't a type of file this accepts.`
    if (reason === "file-too-large" && maxSize !== undefined)
      return `${file.name} is larger than ${formatFileSize(maxSize, locale)}.`
    if (reason === "file-too-small" && minSize !== undefined)
      return `${file.name} is smaller than ${formatFileSize(minSize, locale)}.`
    if (reason === "too-many-files" && maxFiles !== undefined)
      return `${file.name} wasn't added: up to ${String(maxFiles)} files.`
    return `${file.name} wasn't added.`
  },
}

function FileInput({ className, ...props }: ComponentProps<typeof FileInputPrimitive>) {
  return <FileInputPrimitive className={cnState("flex flex-col gap-items", className)} {...props} />
}

type FileInputTriggerProps = ComponentProps<typeof FileInputTriggerPrimitive> & {
  variant?: "default" | "secondary" | "outline" | "ghost"
  size?: "sm" | "default" | "lg"
}

function FileInputTrigger({ className, variant = "outline", size = "sm", ...props }: FileInputTriggerProps) {
  return (
    <FileInputTriggerPrimitive
      className={cnState(cn(buttonVariants({ variant, size }), "data-invalid:border-destructive"), className)}
      {...props}
    />
  )
}

function FileInputDropzone({ className, ...props }: ComponentProps<typeof FileInputDropzonePrimitive>) {
  return (
    <FileInputDropzonePrimitive
      className={cnState(
        [
          "flex flex-col items-center justify-center gap-items rounded-lg border-2 border-dashed border-input-strong bg-field/(--glass-opacity) p-inset-surface text-center text-body-sm text-muted-foreground transition-colors duration-micro ease-standard",
          "focus-within:border-ring has-[[data-slot=file-input-trigger]:focus-visible]:border-ring",
          "data-dragging:border-primary data-drag-accept:border-primary data-drag-accept:bg-accent data-drag-accept:text-accent-foreground",
          "data-drag-reject:border-destructive-border data-drag-reject:bg-destructive-soft data-drag-reject:text-destructive-soft-foreground",
          "data-invalid:border-destructive-border data-disabled:cursor-not-allowed data-disabled:opacity-50",
        ].join(" "),
        className,
      )}
      {...props}
    />
  )
}

function FileInputList({ className, ...props }: ComponentProps<typeof FileInputListPrimitive>) {
  return <FileInputListPrimitive className={cn("flex flex-wrap gap-items", className)} {...props} />
}

function FileInputItem({ className, ...props }: ComponentProps<typeof FileInputItemPrimitive>) {
  return (
    <FileInputItemPrimitive
      className={cnState(
        "relative flex min-w-0 items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
      {...props}
    />
  )
}

function FileInputItemRemove({
  className,
  children,
  "aria-label": ariaLabel,
  tooltip,
  ...props
}: ComponentProps<typeof FileInputItemRemovePrimitive> & { tooltip?: ControlTooltipOption }) {
  return (
    <ControlTooltip label={ariaLabel} tooltip={tooltip} iconOnly={children === undefined}>
      <FileInputItemRemovePrimitive
        aria-label={ariaLabel}
        className={cnState(
          "touch-target absolute -end-inline -top-inline inline-flex size-5 cursor-pointer items-center justify-center rounded-full border bg-background text-muted-foreground shadow-xs transition-colors outline-none hover:bg-accent hover:text-accent-foreground data-disabled:hidden [&_svg]:size-3",
          className,
        )}
        {...props}
      >
        {children ?? <XIcon />}
      </FileInputItemRemovePrimitive>
    </ControlTooltip>
  )
}

type FileInputFilesProps = Omit<ComponentProps<typeof FileInputListPrimitive>, "children"> & {
  labels?: Partial<FileInputLabels>
  locale?: string
}

/** The chosen files as attachment chips (name, type and size) with a remove button each. */
function FileInputFiles({ labels: ownLabels, locale: localeProp, ...props }: FileInputFilesProps) {
  const labels = { ...fileInputLabels, ...ownLabels }
  const locale = useLocale(localeProp)
  return (
    <FileInputList aria-label={labels.list} {...props}>
      <FileInputItem>
        {({ file, index }) => (
          <>
            <AttachmentThumb
              size="sm"
              locale={locale}
              attachment={{
                id: `${String(index)}-${file.name}`,
                name: file.name,
                kind: "file",
                src: "",
                alt: "",
                size: file.size,
                mimeType: file.type,
              }}
            />
            <FileInputItemRemove aria-label={labels.remove(file.name)} />
          </>
        )}
      </FileInputItem>
    </FileInputList>
  )
}

const noLimits: FileLimits = {}

type FileInputRejectionsProps = ComponentProps<"ul"> & {
  rejections: readonly FileRejection[]
  limits?: FileLimits
  labels?: Partial<FileInputLabels>
  locale?: string
}

/**
 * Why files were left out, in the destructive tone. Not a live region: the file input already announces rejected
 * files, so this is what a sighted person reads.
 */
function FileInputRejections({
  rejections,
  limits = noLimits,
  labels: ownLabels,
  locale: localeProp,
  className,
  ...props
}: FileInputRejectionsProps) {
  const rejected = ownLabels?.rejected ?? fileInputLabels.rejected
  const locale = useLocale(localeProp)
  if (rejections.length === 0) return null
  return (
    <ul
      data-slot="file-input-rejections"
      className={cn(
        "flex flex-col gap-inline rounded-control border border-destructive-border bg-destructive-soft px-inset-item py-inset-item text-body-sm text-destructive-soft-foreground",
        className,
      )}
      {...props}
    >
      {rejections.map((rejection) => (
        <li key={`${rejection.file.name}-${String(rejection.file.size)}`} className="flex items-start gap-inline">
          <CircleAlertIcon aria-hidden className="mt-px size-4 shrink-0" />
          <span className="min-w-0 break-words">{rejected(rejection, { ...limits, locale })}</span>
        </li>
      ))}
    </ul>
  )
}

type FileUploadProps = Omit<ComponentProps<typeof FileInputPrimitive>, "children"> & {
  /** The drop zone's prompt, like "Drop files here". */
  title: ReactNode
  /** What it takes, like "PNG or PDF, up to 5 MB". */
  description?: ReactNode
  /** The trigger's text, like "Browse files". */
  browseLabel: ReactNode
  labels?: Partial<FileInputLabels>
  locale?: string
}

/**
 * A drop zone with a browse button, the chosen files as removable chips and why any were left out. Drops, pastes
 * inside the zone and the picker go through the same `accept`, `maxSize`, `minSize`, `maxFiles` and `validate`.
 */
function FileUpload({
  title,
  description,
  browseLabel,
  labels,
  locale,
  onValueChange,
  onReject,
  ...props
}: FileUploadProps) {
  const [rejections, setRejections] = useState<readonly FileRejection[]>([])
  const { maxSize, minSize, maxFiles } = props
  return (
    <FileInput
      {...props}
      onValueChange={(value, details) => {
        onValueChange?.(value, details)
        setRejections(details.rejected)
      }}
      onReject={(rejected, details) => {
        onReject?.(rejected, details)
        setRejections(rejected)
      }}
    >
      <FileInputDropzone data-invalid={rejections.length > 0 ? "" : undefined}>
        <UploadIcon aria-hidden className="size-5" />
        <span className="flex flex-col">
          <span className="text-body font-medium text-foreground">{title}</span>
          {description === undefined ? null : <span>{description}</span>}
        </span>
        <FileInputTrigger>{browseLabel}</FileInputTrigger>
      </FileInputDropzone>
      <FileInputRejections
        rejections={rejections}
        limits={{ maxSize, minSize, maxFiles }}
        labels={labels}
        locale={locale}
      />
      <FileInputFiles labels={labels} locale={locale} />
    </FileInput>
  )
}

export {
  FileInput,
  FileInputDropzone,
  FileInputFiles,
  FileInputItem,
  FileInputItemRemove,
  FileInputList,
  FileInputRejections,
  FileInputTrigger,
  FileUpload,
  fileInputLabels,
}
export { createFileInputController, formatFileSize, relativePath } from "@ui-sdk/react/file-input"
export type {
  FileInputFilesProps,
  FileInputLabels,
  FileInputRejectionsProps,
  FileInputTriggerProps,
  FileLimits,
  FileUploadProps,
}
export type {
  FileInputController,
  FileInputValueChangeDetails,
  FileInputValueChangeReason,
  FileRejection,
  FileRejectionReason,
} from "@ui-sdk/react/file-input"
