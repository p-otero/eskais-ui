export const retryCode = `import { createDataClient, isTransientError } from "@/components/ui/server-data"

// Retry only what may pass next time: a network failure, 408, 425, 429 or a 5xx.
const client = createDataClient({
  retry: (failures, error) => failures < 3 && isTransientError(error),
  retryDelay: (failures) => Math.min(500 * 2 ** failures, 5_000),
})`

export const networkCode = `import { createDataClient } from "@/components/ui/server-data"

// The backend is the desktop app's own process: the browser's online state says nothing about it.
const client = createDataClient({ networkMode: "always" })

// Or per hook: a local read in an app that otherwise waits for the network.
useServerQuery(["settings"], readSettings, { networkMode: "always" })`

export const serialCode = `const failed = useRef(false)
const saveStep = useSourceMutation<Step, Step, Step>({
  source: steps,
  scope: { id: "steps" }, // one at a time, in the order called, from any hook with this scope
  mutationKey: ["steps", "save"], // useMutationState({ filters: { mutationKey } }) lists them
  refreshOnError: false,
  // Runs only once the step before has settled, so its failure is known by then.
  mutationFn: (step) => (failed.current ? Promise.reject(new SkippedStep(step)) : api.saveStep(step)),
  onError: () => {
    failed.current = true
  },
})

async function saveAll(list: Step[]) {
  failed.current = false
  const results = await Promise.allSettled(list.map((step) => saveStep.mutateAsync(step)))
  if (failed.current) await invalidate() // one reload for the whole run
  return results
}`

export const refetchCode = `import { createDataClient } from "@/components/ui/server-data"
import { defineResource, useServerQuery, useServerResource } from "@/components/ui/use-server-query"

// App-wide: reload stale queries on focus too (createDataClient's default is false).
const client = createDataClient({ refetchOnWindowFocus: true })

// One query: true reloads it when stale, "always" even when fresh, false never.
useServerQuery([...tasks.key, "activity"], api.activity, { refetchOnWindowFocus: "always" })

// A list whose reads overwrite each row's ETag, which a later save sends as If-Match: never reload it behind an edit.
// Set it on the definition, so every screen that reads it agrees: one reader that reloads reloads it for all.
export const editableTasks = defineResource({
  key: (projectId: string) => [...tasks.key, "editable", projectId],
  fetch: (projectId: string, { signal }) => api.editableTasks(projectId, { signal }),
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
})

// A call's option wins over the definition's.
useServerResource(editableTasks, projectId, { refetchOnMount: false })`

export const patchCode = `import { patchSource, usePatchSource, type SourcePatch } from "@/components/ui/use-server-data"

// The server told the app a task changed (a push event, another mutation's answer): write it everywhere.
const savedTask = (saved: Task): SourcePatch<Task, Task> => ({
  items: (rows) => rows.map((task) => (task.id === saved.id ? saved : task)), // pages and infinite lists
  resource: (current) => (current?.id === saved.id ? saved : undefined), // useServerQuery; undefined skips
})

const patch = usePatchSource<Task, Task>(tasks)
await patch(savedTask(saved))

// Or confirm with one reload of the key, resolved once the shown queries have reloaded.
await patch(savedTask(saved), { refetch: true })

// Write the answer and stop the reads in flight under the queries it writes, without reading again.
await patch(savedTask(saved), { inFlight: "cancel" })

// No new read, but wait for the reads the patch restarted and fail if one does.
await patch(savedTask(saved), { awaitRestarted: true, throwOnError: true })

// Outside React, as in a socket handler, on the app's client.
socket.on("task", (saved: Task) => void patchSource(client, tasks, savedTask(saved)))

// The call resolves with what it did, by query key: clear an error only when a read ran again.
const { restarted, refetched } = await patch(savedTask(saved))
if (restarted.length + refetched.length > 0) setLoadError(null)`

export const holdCode = `import { holdSource, useHoldSource } from "@/components/ui/use-server-data"

const hold = useHoldSource<Task, Task>(tasks)

async function open(id: string) {
  // Cancel the reads in flight under tasks now; the hooks' reads wait until the hold ends.
  const held = hold()
  try {
    // Your own request, another endpoint than the resource's query function on a first load.
    const task = await api.openTask(id)
    // Write the answer and end the hold: a written query's paused read is dropped, the rest run.
    await held.patch({
      items: (rows) => rows.map((row) => (row.id === task.id ? task : row)),
      resource: (current, queryKey) => (queryKey[2] === task.id ? task : undefined),
    })
  } catch (error) {
    // The paused reads run again; after the patch has ended the hold, this does nothing.
    held.release()
    throw error
  }
}

// Outside React, on the app's client.
const held = holdSource<Task, Task>(client, tasks)`

export const pollingCode = `import { useServerQuery } from "@/components/ui/use-server-query"

// Ask every 2 s while the login is pending; stop once it isn't.
const login = useServerQuery([...auth.key, "login", attempt], ({ signal }) => api.loginStatus(attempt, { signal }), {
  refetchInterval: (state) => (state.data?.status === "pending" ? 2000 : false),
})

// A table or list that follows the server, also while the tab is hidden.
<ServerDataTable label="Jobs" source={jobs} columns={columns} labels={labels} refetchInterval={10_000} refetchIntervalInBackground />

// With your own status: leave polls out of what it announces.
<DataState status={page.status} data={page.items} fetching={page.fetching && !page.polling}>{renderRows}</DataState>`
