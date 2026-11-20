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
