import { vi } from "vitest"

// A microphone in jsdom: a MediaStream of one audio track, an AudioContext whose analyser reads a sine at `amplitude`,
// and animation frames that only run when a test steps them.

class FakeTrack extends EventTarget {
  kind = "audio"
  readyState: "live" | "ended" = "live"
  stop() {
    this.readyState = "ended"
  }
  end() {
    this.readyState = "ended"
    this.dispatchEvent(new Event("ended"))
  }
}

class FakeStream extends EventTarget {
  readonly track = new FakeTrack()
  getAudioTracks() {
    return [this.track] as unknown as MediaStreamTrack[]
  }
  getTracks() {
    return this.getAudioTracks()
  }
}

const audio = { amplitude: 0, contexts: [] as FakeAudioContext[], nodes: [] as FakeNode[] }

class FakeNode {
  connected = false
  constructor() {
    audio.nodes.push(this)
  }
  connect() {
    this.connected = true
  }
  disconnect() {
    this.connected = false
  }
}

class FakeAnalyser extends FakeNode {
  fftSize = 2048
  smoothingTimeConstant = 0.8
  getFloatTimeDomainData(buffer: Float32Array) {
    for (let index = 0; index < buffer.length; index += 1) {
      buffer[index] = audio.amplitude * Math.SQRT2 * Math.sin((2 * Math.PI * index) / 32)
    }
  }
}

class FakeAudioContext extends EventTarget {
  state: AudioContextState = "suspended"
  constructor() {
    super()
    audio.contexts.push(this)
  }
  resume() {
    this.state = "running"
    this.dispatchEvent(new Event("statechange"))
    return Promise.resolve()
  }
  close() {
    this.state = "closed"
    return Promise.resolve()
  }
  createAnalyser() {
    return new FakeAnalyser()
  }
  createMediaStreamSource() {
    return new FakeNode()
  }
}

let frames = new Map<number, FrameRequestCallback>()
let nextFrame = 1
let clock = 0

function installFakeAudio() {
  audio.amplitude = 0
  audio.contexts = []
  audio.nodes = []
  frames = new Map()
  clock = 0
  vi.stubGlobal("AudioContext", FakeAudioContext)
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = nextFrame++
    frames.set(id, callback)
    return id
  })
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id))
}

/** Runs `count` animation frames, `ms` apart. */
function stepFrames(count = 1, ms = 16) {
  for (let frame = 0; frame < count; frame += 1) {
    clock += ms
    const pending = [...frames.values()]
    frames = new Map()
    for (const callback of pending) callback(clock)
  }
}

const pendingFrames = () => frames.size

function setHidden(hidden: boolean) {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (hidden ? "hidden" : "visible") })
  document.dispatchEvent(new Event("visibilitychange"))
}

const fakeStream = () => new FakeStream() as unknown as MediaStream & { track: FakeTrack }

export { audio, fakeStream, installFakeAudio, pendingFrames, setHidden, stepFrames }
