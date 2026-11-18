import { Suspense, use, useState, useSyncExternalStore } from "react"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { arraySource } from "@/lib/array-source"
import { createPageController, type PageController } from "@/lib/page-controller"
import type { PageRequest, PageResult } from "@/lib/page-source"

type Person = { id: string; name: string }

const names = ["Ada", "Grace", "Alan", "Edsger", "Barbara", "Donald", "Frances", "John", "Margaret", "Ken", "Radia"]
const people: Person[] = Array.from({ length: 42 }, (_, index) => ({
  id: String(index + 1),
  name: `${names[index % names.length] ?? "Person"} ${String(index + 1)}`,
}))

const source = arraySource<Person, { q?: string }>(people, { delay: 300, search: { fields: ["name"] } })

function load(request: PageRequest<{ q?: string }>) {
  return source.fetchPage(request, { signal: new AbortController().signal })
}

function Rows({ page, controller }: { page: Promise<PageResult<Person>>; controller: PageController<{ q?: string }> }) {
  const result = use(page)
  const state = controller.getState()
  return (
    <>
      <ul className="flex flex-col gap-inline text-body">
        {result.items.map((person) => (
          <li key={person.id}>{person.name}</li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-items">
        <Button variant="outline" disabled={!result.hasPrevious} onClick={() => controller.previous(result)}>
          Previous page
        </Button>
        <Button variant="outline" disabled={!result.hasMore} onClick={() => controller.next(result)}>
          Next page
        </Button>
        <output className="text-body-sm text-muted-foreground tabular-nums">
          {controller.statusText(result)} · page {state.page} · {controller.navigation(result)}
        </output>
      </div>
    </>
  )
}

export default function PageSourceDemo() {
  const [controller] = useState(() => createPageController(source, { pageSize: 5 }))
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState)
  const [pages] = useState(() => new Map<string, Promise<PageResult<Person>>>())
  const key = JSON.stringify(state.request)
  let page = pages.get(key)
  if (!page) {
    page = load(state.request)
    pages.set(key, page)
  }
  return (
    <div className="flex w-full max-w-md flex-col gap-group">
      <Suspense fallback={<Spinner label="Loading people" />}>
        <Rows page={page} controller={controller} />
      </Suspense>
    </div>
  )
}
