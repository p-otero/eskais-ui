import type { QueryKey } from "@tanstack/react-query"
import { renderHook } from "@testing-library/react"
import { spawnSync } from "node:child_process"
import { join } from "node:path"
import type { ReactNode } from "react"
import { describe, expect, expectTypeOf, test } from "vitest"

import { createDataClient, DataProvider, type DefaultServerError } from "@/components/ui/server-data"
import {
  holdSource,
  patchSource,
  useHoldSource,
  usePatchSource,
  useServerInfinite,
  useServerPage,
  useSourceMutation,
  type PatchOptions,
  type PatchResult,
  type SourceHold,
  type SourcePatch,
} from "@/components/ui/use-server-data"
import { defineResource, useServerQuery, useServerResource } from "@/components/ui/use-server-query"
import { arraySource } from "@/lib/array-source"
import type { HttpError } from "@/lib/page-source"

type Task = { id: string; title: string; done: boolean }

const tasks = arraySource<Task, Record<string, never>>([{ id: "1", title: "A", done: false }], { key: ["tasks"] })
const fetchTask = async () => ({ id: "1", title: "A", done: false })

function wrapper({ children }: { children: ReactNode }) {
  return <DataProvider client={createDataClient({ retry: false })}>{children}</DataProvider>
}

describe("server data types", () => {
  test("errors are unknown unless typed; a type argument types them end to end", () => {
    expectTypeOf<DefaultServerError>().toEqualTypeOf<unknown>()
    const { result } = renderHook(
      () => ({
        plain: useServerQuery(["tasks", "detail", "1"], fetchTask),
        typed: useServerQuery<Task, HttpError>(["tasks", "detail", "1"], fetchTask),
        page: useServerPage<Task, Record<string, never>, HttpError>(tasks, {
          filter: {},
          sort: [],
          size: 10,
          position: { page: 1 },
        }),
        infinite: useServerInfinite<Task, Record<string, never>, HttpError>(tasks, { filter: {}, sort: [], size: 10 }),
        save: useSourceMutation<Task, string, Task, Task, HttpError>({
          source: tasks,
          mutationFn: fetchTask,
          onError: (error) => {
            expectTypeOf(error).toEqualTypeOf<HttpError>()
          },
        }),
      }),
      { wrapper },
    )
    expectTypeOf(result.current.plain.error).toEqualTypeOf<unknown>()
    expectTypeOf(result.current.plain.data).toEqualTypeOf<Task | undefined>()
    expectTypeOf(result.current.typed.error).toEqualTypeOf<HttpError | null>()
    expectTypeOf(result.current.page.error).toEqualTypeOf<HttpError | null>()
    expectTypeOf(result.current.infinite.error).toEqualTypeOf<HttpError | null>()
    expectTypeOf(result.current.save.error).toEqualTypeOf<HttpError | null>()
    expect(result.current.plain.status).toBe("pending")
  })

  test("select types data as the selection; seeds are checked against the seeded resource", () => {
    const summary = defineResource({
      key: (id: string) => ["tasks", "summary", id],
      fetch: async (id: string) => ({ id, title: "A" }),
    })
    const detail = defineResource({
      key: (id: string) => ["tasks", "detail", id],
      fetch: fetchTask,
      seeds: (task: Task) => [summary.seed(task.id, { id: task.id, title: task.title })],
    })
    // @ts-expect-error a seed's data must be the seeded resource's type
    summary.seed("1", { id: "1" })
    const { result } = renderHook(
      () => ({
        title: useServerQuery(["tasks", "detail", "1"], fetchTask, { select: (task) => task.title }),
        done: useServerResource(detail, "1", { select: (task) => task.done }),
        typed: useServerResource<string, Task, HttpError, number>(detail, "1", { select: (task) => task.title.length }),
      }),
      { wrapper },
    )
    expectTypeOf(result.current.title.data).toEqualTypeOf<string | undefined>()
    expectTypeOf(result.current.done.data).toEqualTypeOf<boolean | undefined>()
    expectTypeOf(result.current.typed.data).toEqualTypeOf<number | undefined>()
    expectTypeOf(result.current.typed.error).toEqualTypeOf<HttpError | null>()
    expect(summary.seed("1", { id: "1", title: "A" })).toEqual({
      key: ["tasks", "summary", "1"],
      data: { id: "1", title: "A" },
    })
  })

  test("patch options: inFlight is restart or cancel, awaitRestarted a boolean; the call resolves with its result", async () => {
    expectTypeOf<PatchOptions["inFlight"]>().toEqualTypeOf<"restart" | "cancel" | undefined>()
    expectTypeOf<PatchOptions["awaitRestarted"]>().toEqualTypeOf<boolean | undefined>()
    const client = createDataClient()
    const done = patchSource<Task, Task>(
      client,
      tasks,
      { resource: (current) => current },
      { inFlight: "cancel", awaitRestarted: true, throwOnError: true },
    )
    expectTypeOf(done).toEqualTypeOf<Promise<PatchResult>>()
    expectTypeOf<PatchResult>().toEqualTypeOf<{
      written: readonly QueryKey[]
      cancelled: readonly QueryKey[]
      restarted: readonly QueryKey[]
      refetched: readonly QueryKey[]
    }>()
    const ignored: () => Promise<unknown> = () => patchSource(client, tasks, {})
    void ignored()
    // @ts-expect-error inFlight takes "restart" or "cancel"
    void patchSource(client, tasks, {}, { inFlight: "ignore" })
    // @ts-expect-error awaitRestarted is a boolean
    void patchSource(client, tasks, {}, { awaitRestarted: "yes" })
    await expect(done).resolves.toEqual({ written: [], cancelled: [], restarted: [], refetched: [] })
  })

  test("a hold is typed by its source: its patch takes the source's changes and no inFlight", async () => {
    const client = createDataClient()
    const hold = holdSource<Task, Task>(client, tasks)
    expectTypeOf(hold).toEqualTypeOf<SourceHold<Task, Task>>()
    expectTypeOf(hold.cancelled).toEqualTypeOf<readonly QueryKey[]>()
    expectTypeOf(hold.active).toEqualTypeOf<boolean>()
    expectTypeOf(hold.patch).parameter(0).toEqualTypeOf<SourcePatch<Task, Task>>()
    expectTypeOf(hold.patch).returns.toEqualTypeOf<Promise<PatchResult>>()
    // @ts-expect-error a hold's patch always cancels the reads of the queries it writes
    void hold.patch({}, { inFlight: "restart" })
    // @ts-expect-error a hold's rows are the source's
    void hold.patch({ items: (items: string[]) => items })
    const { result } = renderHook(
      () => ({ hold: useHoldSource<Task, Task>(tasks), patch: usePatchSource<Task, Task>(tasks) }),
      { wrapper },
    )
    expectTypeOf(result.current.hold).returns.toEqualTypeOf<SourceHold<Task, Task>>()
    expectTypeOf(result.current.patch).returns.toEqualTypeOf<Promise<PatchResult>>()
    const done = await hold.patch({ resource: (current) => current })
    expect(done.written).toEqual([])
  })

  test("createDataClient takes retry: false", () => {
    expect(createDataClient({ retry: false }).getDefaultOptions().queries?.retry).toBeTypeOf("function")
  })

  test("a registered defaultError types every hook's error", () => {
    const tsc = join(import.meta.dirname, "..", "node_modules", "typescript", "bin", "tsc")
    const project = join(import.meta.dirname, "fixtures", "register-error", "tsconfig.json")
    const run = spawnSync(process.execPath, [tsc, "-p", project], { encoding: "utf8" })
    expect({ status: run.status, output: run.stdout + run.stderr }).toEqual({ status: 0, output: "" })
  })
})
