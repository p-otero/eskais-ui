import {
  createSkyRunner,
  type FromRunner,
  type RunnerEvents,
  type SkyRunner,
  type ToRunner,
} from "@/components/ui/live-sky-runner"

// Perf: the sky draws here, on an OffscreenCanvas, so its frames, its WebGL calls and, under software compositing, the
// read-back of each frame stay off the page's main thread, where a key press would wait behind them.

let runner: SkyRunner | null = null

const send = (message: FromRunner, transfer: Transferable[] = []) => self.postMessage(message, { transfer })

const events: RunnerEvents = {
  ready: (renderer) => send({ type: "ready", renderer }),
  frame: (milliseconds) => send({ type: "frame", milliseconds }),
  painted: (paints, background) => send({ type: "painted", paints, background }),
  mode: (mode) => send({ type: "mode", mode }),
  still: (canvas) => {
    void createImageBitmap(canvas).then((bitmap) => send({ type: "still", bitmap }, [bitmap]))
  },
}

self.addEventListener("message", (event: MessageEvent<ToRunner>) => {
  const message = event.data
  if (message.type === "start") {
    runner =
      typeof requestAnimationFrame === "function" ? createSkyRunner(message.canvas, message.palette, events) : null
    if (!runner) send({ type: "unsupported" })
    return
  }
  if (!runner) return
  if (message.type === "view") runner.setView(message.view)
  else if (message.type === "update") runner.update(message.input)
  else if (message.type === "photo") runner.setPhoto(message.id, message.layers)
  else runner.noteInput()
})
