;(() => {
  const PerformedWork = 1
  const componentTags = new Set([0, 1, 11, 15])
  const state = {
    commits: 0,
    renders: 0,
    byName: new Map(),
    inputs: [],
    events: [],
    longTasks: [],
    frames: [],
    rafCount: 0,
  }

  function nameOf(fiber) {
    const type = fiber.type
    if (!type) return "?"
    return type.displayName || type.name || type.render?.displayName || type.render?.name || "Anonymous"
  }

  // Spec: React keeps a skipped subtree's previous fibers with stale flags, so descend only where this render cloned the
  // child list (`fiber.child !== fiber.alternate.child`), as React DevTools does.
  function countCommit(root) {
    state.commits += 1
    const stack = [root.current]
    while (stack.length > 0) {
      const fiber = stack.pop()
      const alternate = fiber.alternate
      if (componentTags.has(fiber.tag) && (alternate === null || (fiber.flags & PerformedWork) === PerformedWork)) {
        state.renders += 1
        const name = nameOf(fiber)
        state.byName.set(name, (state.byName.get(name) ?? 0) + 1)
      }
      if (fiber.child && !(alternate && alternate.child === fiber.child)) {
        for (let child = fiber.child; child; child = child.sibling) stack.push(child)
      }
    }
  }

  let renderers = 0
  globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    renderers: new Map(),
    supportsFiber: true,
    isDisabled: false,
    inject(renderer) {
      renderers += 1
      this.renderers.set(renderers, renderer)
      return renderers
    },
    onCommitFiberRoot(_id, root) {
      try {
        countCommit(root)
      } catch {}
    },
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
    onScheduleFiberRoot() {},
    checkDCE() {},
  }

  // Renders are read in `beforePaint`, as the frame starts: a virtualized list publishes rows that left the view with
  // requestAnimationFrame then setTimeout, and whether that timer or this message runs first is the scheduler's choice.
  // When the timer won, a press counted rows meant for after its paint (list-10k read 60 instead of 10 on one CI run).
  function afterPaint(callback, beforePaint) {
    requestAnimationFrame(() => {
      beforePaint?.()
      const channel = new MessageChannel()
      channel.port1.addEventListener("message", callback)
      channel.port1.start()
      channel.port2.postMessage(null)
    })
  }

  for (const type of ["keydown", "pointerdown", "input"]) {
    addEventListener(
      type,
      (event) => {
        const entry = { type, key: event.key, start: event.timeStamp, rendersBefore: state.renders }
        state.inputs.push(entry)
        afterPaint(
          () => {
            entry.paint = performance.now() - event.timeStamp
          },
          () => {
            entry.renders = state.renders - entry.rendersBefore
          },
        )
      },
      { capture: true },
    )
  }

  // oxlint-disable-next-line unicorn/consistent-function-scoping -- a classic page script: helpers outside the IIFE would be globals in the page under test
  const observe = (type, options, push) => {
    try {
      new PerformanceObserver((list) => list.getEntries().forEach(push)).observe({ type, ...options })
    } catch {
      // Spec: PerformanceObserver.observe throws on an entry type this browser doesn't support.
    }
  }
  observe("event", { durationThreshold: 16 }, (entry) =>
    state.events.push({
      name: entry.name,
      interactionId: entry.interactionId,
      duration: entry.duration,
      processing: entry.processingEnd - entry.processingStart,
      delay: entry.processingStart - entry.startTime,
    }),
  )
  observe("longtask", {}, (entry) => state.longTasks.push({ start: entry.startTime, duration: entry.duration }))
  observe("long-animation-frame", {}, (entry) =>
    state.frames.push({
      start: entry.startTime,
      duration: entry.duration,
      blocking: entry.blockingDuration,
      styleAndLayout: entry.renderStart ? entry.startTime + entry.duration - entry.styleAndLayoutStart : 0,
      script: entry.scripts.reduce((sum, script) => sum + script.duration, 0),
      forcedStyleAndLayout: entry.scripts.reduce((sum, script) => sum + script.forcedStyleAndLayoutDuration, 0),
    }),
  )

  let counting = false
  function countFrames() {
    if (!counting) return
    state.rafCount += 1
    requestAnimationFrame(countFrames)
  }

  function watch(selector, appear = true) {
    return new Promise((resolve) => {
      let start = null
      const onInput = (event) => {
        if (start === null) start = event.timeStamp
      }
      addEventListener("keydown", onInput, { capture: true })
      addEventListener("pointerdown", onInput, { capture: true })
      // oxlint-disable-next-line unicorn/consistent-function-scoping -- a classic page script: helpers outside the IIFE would be globals in the page under test
      const visible = (el) => {
        if (!el || !el.isConnected) return false
        const box = el.getBoundingClientRect()
        const style = getComputedStyle(el)
        return box.width > 0 && box.height > 0 && style.visibility !== "hidden" && style.display !== "none"
      }
      const done = (result) => {
        removeEventListener("keydown", onInput, { capture: true })
        removeEventListener("pointerdown", onInput, { capture: true })
        resolve(result)
      }
      const tick = () => {
        if (start !== null) {
          const el = document.querySelector(selector)
          if (appear ? visible(el) : !visible(el)) {
            afterPaint(() => {
              const firstFrame = performance.now() - start
              const animations = el ? el.getAnimations({ subtree: true }) : []
              Promise.all(animations.map((animation) => animation.finished.catch(() => undefined))).then(() => {
                const settle = () => {
                  const gone = document.querySelector(selector)
                  if (!appear && gone && gone.getAnimations({ subtree: true }).some((a) => a.playState === "running")) {
                    requestAnimationFrame(settle)
                    return
                  }
                  afterPaint(() => done({ firstFrame, settled: performance.now() - start }))
                }
                settle()
              })
            })
            return
          }
        }
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
      setTimeout(() => done({ firstFrame: Number.NaN, settled: Number.NaN, timeout: true }), 5000)
    })
  }

  globalThis.__perf = {
    afterPaint: () => new Promise((resolve) => afterPaint(resolve)),
    reset() {
      state.renders = 0
      state.commits = 0
      state.byName = new Map()
      state.inputs = []
      state.events = []
      state.longTasks = []
      state.frames = []
    },
    startFrames() {
      state.rafCount = 0
      counting = true
      requestAnimationFrame(countFrames)
    },
    stopFrames() {
      counting = false
      return state.rafCount
    },
    pending: () => state.inputs.filter((input) => input.paint === undefined).length,
    inputCount: () => state.inputs.length,
    take() {
      return {
        commits: state.commits,
        renders: state.renders,
        byName: Object.fromEntries([...state.byName].toSorted((a, b) => b[1] - a[1])),
        inputs: state.inputs.map(({ type, key, paint, renders }) => ({ type, key, paint, renders })),
        events: state.events,
        longTasks: state.longTasks,
        frames: state.frames,
      }
    },
    watch,
  }
})()
