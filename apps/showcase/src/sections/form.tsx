import { useState } from "react"
import { z } from "zod"

import { Checkbox, CheckboxIndicator } from "@/components/ui/checkbox"
import {
  FieldSet,
  Form,
  FormActions,
  FormField,
  FormRootError,
  FormServerError,
  formMessagesEs,
} from "@/components/ui/form"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { FormDialog } from "@/components/ui/form-dialog"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import {
  NumberInput,
  NumberInputControl,
  NumberInputDecrement,
  NumberInputGroup,
  NumberInputIncrement,
} from "@/components/ui/number-input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

import { Section } from "../section"

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const regions = [
  { value: "mad", label: "Madrid" },
  { value: "fra", label: "Fráncfort" },
  { value: "iad", label: "Virginia" },
]

const countries = [
  { value: "es", label: "España" },
  { value: "mx", label: "México" },
  { value: "ar", label: "Argentina" },
  { value: "co", label: "Colombia" },
]

const deploymentSchema = z.object({
  name: z.string().min(3).max(32),
  owner: z.email(),
  repository: z.url(),
  region: z
    .string()
    .nullable()
    .refine((value) => value !== null, "form.region.missing"),
  instances: z.number().min(1).max(10),
  billing: z
    .string()
    .nullable()
    .refine((value) => value !== null, "form.billing.missing"),
  window: z.string().nullable(),
  notes: z.string().max(200),
  terms: z.boolean().refine(Boolean, "form.terms.missing"),
})

type Deployment = z.output<typeof deploymentSchema>

const defaults: z.input<typeof deploymentSchema> = {
  name: "",
  owner: "",
  repository: "",
  region: null,
  instances: 1,
  billing: null,
  window: null,
  notes: "",
  terms: false,
}

const messages = {
  ...formMessagesEs,
  "form.region.missing": "Elige una región.",
  "form.billing.missing": "Elige el país de facturación.",
  "form.terms.missing": "Acepta las condiciones para continuar.",
  "owner.taken": "Ese responsable ya tiene un despliegue activo.",
}

async function createDeployment(values: Deployment) {
  await wait(900)
  if (values.owner.endsWith("@ocupado.dev")) {
    throw new FormServerError("No se pudo crear el despliegue.", { owner: { code: "owner.taken" } })
  }
  if (values.name.toLowerCase() === "caido")
    throw new Error("El servicio de despliegues no responde. Inténtalo más tarde.")
}

function DeploymentFields() {
  return (
    <>
      <div className="grid gap-group sm:grid-cols-2">
        <FormField name="name" label="Nombre del proyecto" description="Entre 3 y 32 caracteres." required>
          <Input autoComplete="off" placeholder="atlas-web" />
        </FormField>
        <FormField name="owner" label="Correo del responsable" required>
          <Input type="email" autoComplete="email" placeholder="ana@ejemplo.dev" />
        </FormField>
      </div>
      <FormField name="repository" label="Repositorio" required>
        <Input type="url" placeholder="https://git.ejemplo.dev/atlas" />
      </FormField>
      <FieldSet legend="Infraestructura" description="Puedes cambiarla después.">
        <div className="grid gap-group sm:grid-cols-2">
          <FormField name="region" label="Región" required>
            <Select options={regions} placeholder="Elige una región" />
          </FormField>
          <FormField name="instances" label="Instancias">
            <NumberInput min={1} max={10}>
              <NumberInputGroup>
                <NumberInputDecrement aria-label="Quitar una instancia" />
                <NumberInputControl />
                <NumberInputIncrement aria-label="Añadir una instancia" />
              </NumberInputGroup>
            </NumberInput>
          </FormField>
        </div>
      </FieldSet>
      <FormField
        name="billing"
        label="País de facturación"
        description="Un select nativo: en el móvil abre el selector del sistema."
      >
        <NativeSelect options={countries} placeholder="Elige un país" />
      </FormField>
      <FormField name="window" label="Ventana de mantenimiento" description="Opcional. Hora local de la región.">
        <DateTimePicker locale="es-ES" timeZone="Europe/Madrid" min="2026-11-16T08:00" labels={{ time: "Hora" }} />
      </FormField>
      <FormField name="notes" label="Notas para el equipo">
        <Textarea />
      </FormField>
      <FormField name="terms" label="Acepto las condiciones del servicio">
        <Checkbox>
          <CheckboxIndicator />
        </Checkbox>
      </FormField>
    </>
  )
}

function DeploymentForm() {
  const [created, setCreated] = useState<string | null>(null)
  return (
    <Form
      schema={deploymentSchema}
      defaultValues={defaults}
      messages={messages}
      label="Nuevo despliegue"
      onSubmit={async (values) => {
        setCreated(null)
        await createDeployment(values)
        setCreated(values.name)
      }}
      className="w-full max-w-2xl"
    >
      <DeploymentFields />
      <FormRootError />
      <output className="text-sm text-muted-foreground empty:hidden">
        {created === null ? null : `Despliegue «${created}» creado.`}
      </output>
      <FormActions submitLabel="Crear despliegue" pendingLabel="Creando el despliegue" />
    </Form>
  )
}

function Review({ values }: { values: Deployment }) {
  const rows = [
    ["Proyecto", values.name],
    ["Responsable", values.owner],
    ["Repositorio", values.repository],
    ["Región", regions.find((region) => region.value === values.region)?.label ?? "—"],
    ["Instancias", String(values.instances)],
    ["Mantenimiento", values.window ?? "—"],
  ]
  return (
    <>
      <p className="text-sm text-muted-foreground">Revisa los datos antes de crear el despliegue.</p>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
        {rows.map(([term, detail]) => (
          <div key={term} className="contents">
            <dt className="text-muted-foreground">{term}</dt>
            <dd className="min-w-0 font-medium wrap-anywhere sm:col-span-2">{detail}</dd>
          </div>
        ))}
      </dl>
    </>
  )
}

function DeploymentDialog() {
  const [created, setCreated] = useState<string | null>(null)
  return (
    <div className="flex flex-wrap items-center gap-3">
      <FormDialog
        schema={deploymentSchema}
        defaultValues={defaults}
        messages={messages}
        trigger="Nuevo despliegue con revisión"
        title="Nuevo despliegue"
        description="Se crea en la región que elijas. Lo revisas antes de confirmar."
        size="lg"
        submitLabel="Revisar"
        cancelLabel="Cancelar"
        pendingLabel="Creando el despliegue"
        confirmDiscard="¿Descartar el despliegue que estás preparando?"
        discardLabel="Descartar"
        keepEditingLabel="Seguir editando"
        reviewStep={{
          render: (values) => <Review values={values} />,
          editLabel: "Editar",
          confirmLabel: "Crear despliegue",
        }}
        onSubmit={async (values) => {
          setCreated(null)
          await createDeployment(values)
          setCreated(values.name)
        }}
      >
        <DeploymentFields />
      </FormDialog>
      <output className="text-sm text-muted-foreground empty:hidden">
        {created === null ? null : `Despliegue «${created}» creado.`}
      </output>
    </div>
  )
}

function FormSection() {
  return (
    <Section
      title="Form"
      description="Form + FormField on react-hook-form with a Zod schema and Spanish messages. Try an owner ending in @ocupado.dev for a server error on its field, or the name caido for a root error. The dialog validates, shows a review, then submits."
    >
      <div lang="es" className="flex w-full flex-col gap-6">
        <DeploymentForm />
        <DeploymentDialog />
      </div>
    </Section>
  )
}

export { DeploymentFields, FormSection, createDeployment, defaults, deploymentSchema, messages }
