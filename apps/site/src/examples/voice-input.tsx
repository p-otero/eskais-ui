import { useCallback, useState } from "react"

import { Toggle } from "@/components/ui/toggle"
import { VoiceInput, type VoiceInputState } from "@/components/ui/voice-input"
import { requestMicrophone, stopStream } from "@/lib/microphone"

// A stand-in for a voice: a buzz whose loudness rises and falls like syllables, so the demo moves without a microphone.
function speechLikeStream() {
  const context = new AudioContext()
  const voice = new OscillatorNode(context, { type: "sawtooth", frequency: 140 })
  const syllables = new OscillatorNode(context, { frequency: 3.3 })
  const phrases = new OscillatorNode(context, { frequency: 0.4 })
  const loudness = new GainNode(context, { gain: 0.06 })
  syllables.connect(new GainNode(context, { gain: 0.05 })).connect(loudness.gain)
  phrases.connect(new GainNode(context, { gain: 0.03 })).connect(loudness.gain)
  const output = new MediaStreamAudioDestinationNode(context)
  voice.connect(loudness).connect(output)
  for (const node of [voice, syllables, phrases]) node.start()
  return {
    stream: output.stream,
    stop: () => {
      stopStream(output.stream)
      void context.close()
    },
  }
}

type Source = { stream: MediaStream; stop: () => void }

function useVoiceDemo(useMicrophone: boolean, running: Set<Source>) {
  const [state, setState] = useState<VoiceInputState>("idle")
  const [startedAt, setStartedAt] = useState<number>()
  const [kept, setKept] = useState<number>()
  const [source, setSource] = useState<Source | null>(null)

  const release = () => {
    source?.stop()
    if (source) running.delete(source)
    setSource(null)
  }

  const start = async () => {
    setState("requesting")
    let next: Source
    if (useMicrophone) {
      const result = await requestMicrophone()
      if (result.state !== "listening") {
        setState(result.state)
        return
      }
      next = { stream: result.stream, stop: () => stopStream(result.stream) }
    } else {
      next = speechLikeStream()
    }
    running.add(next)
    setSource(next)
    setStartedAt(Date.now())
    setState("listening")
  }

  const props = {
    state,
    stream: source?.stream,
    startedAt,
    onStart: () => void start(),
    onConfirm: () => {
      release()
      setState("processing")
      setKept(Math.round((Date.now() - (startedAt ?? Date.now())) / 1000))
      setTimeout(() => setState("idle"), 1200)
    },
    onCancel: () => {
      release()
      setState("idle")
    },
  }
  return { props, kept }
}

export default function VoiceInputDemo() {
  const [useMicrophone, setUseMicrophone] = useState(false)
  const [running] = useState(() => new Set<Source>())
  const message = useVoiceDemo(useMicrophone, running)
  const note = useVoiceDemo(useMicrophone, running)
  // Leaving the page stops whatever is still playing or recording.
  const stopAll = useCallback(() => () => running.forEach((source) => source.stop()), [running])

  return (
    <div ref={stopAll} className="flex w-full max-w-lg flex-col gap-group">
      <div className="flex items-center gap-items">
        <VoiceInput {...message.props} labels={{ group: "Voice message" }} />
        <p className="text-body-sm text-muted-foreground" aria-live="polite">
          {message.kept === undefined ? "Press the microphone and speak." : `Kept ${String(message.kept)} s of speech.`}
        </p>
      </div>
      <VoiceInput
        variant="bar"
        {...note.props}
        labels={{ group: "Voice note", toggle: "Record note", cancel: "Discard note" }}
      />
      <Toggle variant="outline" pressed={useMicrophone} onPressedChange={setUseMicrophone} className="self-start">
        Try with your microphone
      </Toggle>
    </div>
  )
}
