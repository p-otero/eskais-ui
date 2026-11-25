import { useLayoutEffect } from "react"

declare global {
  var perfFixture: { scenario: string; start: number; mounted?: number } | undefined
}

function usePerfMounted() {
  useLayoutEffect(() => {
    requestAnimationFrame(() => {
      const channel = new MessageChannel()
      channel.port1.addEventListener("message", () => {
        if (globalThis.perfFixture) globalThis.perfFixture.mounted = performance.now() - globalThis.perfFixture.start
      })
      channel.port1.start()
      channel.port2.postMessage(null)
    })
  }, [])
}

export { usePerfMounted }
