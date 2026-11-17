import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Code } from "@/components/ui/code-block"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { memoryUrlState, useUrlState } from "@/lib/url-state"

export default function UrlStateDemo() {
  const [adapter] = useState(() => memoryUrlState("?q=login&page=2"))
  const [params, setParams] = useUrlState(adapter)
  const page = Number(params.get("page") ?? "1")
  const write = (name: string, value: string | null, replace = true) => {
    const next = new URLSearchParams(params)
    if (value === null || value === "") next.delete(name)
    else next.set(name, value)
    if (name !== "page") next.delete("page")
    setParams(next, { replace })
  }
  return (
    <div className="flex w-full max-w-md flex-col gap-group">
      <Field>
        <FieldLabel>Search</FieldLabel>
        <Input value={params.get("q") ?? ""} onValueChange={(q) => write("q", q)} />
      </Field>
      <div className="flex flex-wrap items-center gap-items">
        <Button variant="outline" disabled={page <= 1} onClick={() => write("page", String(page - 1), false)}>
          Previous page
        </Button>
        <Button variant="outline" onClick={() => write("page", String(page + 1), false)}>
          Next page
        </Button>
      </div>
      <p className="flex flex-wrap items-center gap-inline text-body-sm text-muted-foreground">
        URL query <Code>?{params.toString()}</Code>, {adapter.history.length} writes
      </p>
    </div>
  )
}
