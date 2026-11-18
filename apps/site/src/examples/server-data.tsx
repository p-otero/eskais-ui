import { useState } from "react"

import { Button } from "@/components/ui/button"
import { DataState } from "@/components/ui/data-state"
import { usePageController, useServerPage } from "@/components/ui/use-server-data"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { arraySource } from "@/lib/array-source"

type City = { id: string; name: string; country: string }

const cities: City[] = [
  ["Lisbon", "Portugal"],
  ["Madrid", "Spain"],
  ["Paris", "France"],
  ["Berlin", "Germany"],
  ["Rome", "Italy"],
  ["Vienna", "Austria"],
  ["Prague", "Czechia"],
  ["Warsaw", "Poland"],
  ["Oslo", "Norway"],
  ["Dublin", "Ireland"],
  ["Athens", "Greece"],
  ["Tallinn", "Estonia"],
].map(([name = "", country = ""]) => ({ id: name.toLowerCase(), name, country }))

const failing = { on: false }
const source = arraySource<City, Record<string, never>>(cities, {
  key: ["demo", "cities"],
  delay: 600,
  fail: () => (failing.on ? Object.assign(new Error("The server answered 503."), { status: 503 }) : undefined),
})

export default function ServerDataDemo() {
  const [fail, setFail] = useState(false)
  const { state, controller } = usePageController(source, { pageSize: 4 })
  const page = useServerPage(source, state.request)
  return (
    <div className="flex w-full max-w-md flex-col gap-group">
      <Label className="flex items-center gap-items">
        <Switch
          checked={fail}
          onCheckedChange={(checked) => {
            failing.on = checked
            setFail(checked)
          }}
        />
        Fail requests
      </Label>
      <DataState
        status={page.status}
        data={page.result?.items}
        error={page.error}
        fetching={page.fetching}
        onRetry={page.retry}
        labels={{ errorTitle: "Couldn't load cities", retry: "Try again", emptyTitle: "No cities" }}
        size="inline"
      >
        {(items) => (
          <ul className="flex flex-col gap-inline text-body">
            {items.map((city) => (
              <li key={city.id} className="flex justify-between gap-items">
                <span>{city.name}</span>
                <span className="text-muted-foreground">{city.country}</span>
              </li>
            ))}
          </ul>
        )}
      </DataState>
      <div className="flex flex-wrap items-center gap-items">
        <Button variant="outline" disabled={state.page <= 1} onClick={() => controller.previous(page.result)}>
          Previous page
        </Button>
        <Button variant="outline" disabled={!page.result?.hasMore} onClick={() => controller.next(page.result)}>
          Next page
        </Button>
        <output className="text-body-sm text-muted-foreground tabular-nums">
          {controller.statusText(page.result, page.total.kind === "exact" ? page.total.value : undefined)}
        </output>
      </div>
    </div>
  )
}
