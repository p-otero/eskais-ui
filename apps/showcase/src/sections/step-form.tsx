import { useState } from "react"
import { z } from "zod"

import { FormField, formMessagesEs } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { StepDialog, StepForm, type FormStep } from "@/components/ui/step-dialog"
import { Textarea } from "@/components/ui/textarea"

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const schema = z.object({
  name: z.string().min(3),
  region: z.enum(["mad", "fra"]),
  brief: z.string().min(10),
})

type Values = z.input<typeof schema>

const steps: FormStep<Values>[] = [
  {
    id: "proyecto",
    title: "Proyecto",
    description: "Un nombre que tu equipo reconozca.",
    render: () => (
      <FormField name="name" label="Nombre del proyecto">
        <Input placeholder="atlas-web" />
      </FormField>
    ),
  },
  {
    id: "region",
    title: "Región",
    description: "Dónde se ejecutan sus agentes.",
    render: () => (
      <FormField name="region" label="Región">
        <Select
          options={[
            { value: "mad", label: "Madrid" },
            { value: "fra", label: "Fráncfort" },
          ]}
        />
      </FormField>
    ),
  },
  {
    id: "encargo",
    title: "Encargo",
    render: () => (
      <FormField name="brief" label="¿Qué deben hacer primero?">
        <Textarea placeholder="Indexar la documentación y abrir una pull request." />
      </FormField>
    ),
  },
]

const labels = { next: "Siguiente", back: "Atrás", submit: "Crear proyecto", progress: "Progreso" }
const defaults: Values = { name: "", region: "mad", brief: "" }

function StepFormDemo() {
  const [created, setCreated] = useState<string | null>(null)
  const create = async (values: z.output<typeof schema>) => {
    await wait(700)
    setCreated(values.name)
  }
  return (
    <div className="flex w-full max-w-xl flex-col gap-6">
      <StepForm
        schema={schema}
        defaultValues={defaults}
        steps={steps}
        messages={formMessagesEs}
        label="Proyecto en pasos"
        labels={labels}
        onSubmit={create}
      />
      <StepDialog
        schema={schema}
        defaultValues={defaults}
        steps={steps}
        messages={formMessagesEs}
        trigger="Nuevo proyecto en pasos"
        title="Nuevo proyecto"
        labels={{ ...labels, cancel: "Cancelar" }}
        onSubmit={create}
      />
      <output className="text-sm text-muted-foreground empty:hidden">
        {created === null ? null : `Proyecto «${created}» creado.`}
      </output>
    </div>
  )
}

export { StepFormDemo }
