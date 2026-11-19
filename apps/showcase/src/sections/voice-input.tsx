import { useState } from "react"

import { VoiceInput, type VoiceInputState } from "@/components/ui/voice-input"
import { requestMicrophone, stopStream } from "@/lib/microphone"
import { Toggle } from "@/components/ui/toggle"

import { Section } from "../section"

// A buzz whose loudness rises and falls like syllables, so the section moves without a microphone.
function speechLikeStream() {
  const context = new AudioContext()
  const voice = new OscillatorNode(context, { type: "sawtooth", frequency: 140 })
  const syllables = new OscillatorNode(context, { frequency: 3.3 })
  const loudness = new GainNode(context, { gain: 0.06 })
  syllables.connect(new GainNode(context, { gain: 0.05 })).connect(loudness.gain)
  const output = new MediaStreamAudioDestinationNode(context)
  voice.connect(loudness).connect(output)
  voice.start()
  syllables.start()
  return { stream: output.stream, stop: () => void context.close().then(() => stopStream(output.stream)) }
}

type Source = { stream: MediaStream; stop: () => void }

function DemoVoiceInput({ variant, microphone }: { variant: "button" | "bar"; microphone: boolean }) {
  const [state, setState] = useState<VoiceInputState>("idle")
  const [source, setSource] = useState<Source | null>(null)
  const [startedAt, setStartedAt] = useState<number>()

  const start = async () => {
    setState("requesting")
    let next: Source
    if (microphone) {
      const result = await requestMicrophone()
      if (result.state !== "listening") {
        setState(result.state)
        return
      }
      next = { stream: result.stream, stop: () => stopStream(result.stream) }
    } else {
      next = speechLikeStream()
    }
    setSource(next)
    setStartedAt(Date.now())
    setState("listening")
  }
  const finish = (next: VoiceInputState) => {
    source?.stop()
    setSource(null)
    setState(next)
    if (next === "processing") setTimeout(() => setState("idle"), 1200)
  }

  return (
    <VoiceInput
      variant={variant}
      state={state}
      stream={source?.stream}
      startedAt={startedAt}
      labels={variant === "bar" ? { group: "Voice note", toggle: "Record note", cancel: "Discard note" } : undefined}
      onStart={() => void start()}
      onConfirm={() => finish("processing")}
      onCancel={() => finish("idle")}
    />
  )
}

function VoiceInputSection() {
  const [microphone, setMicrophone] = useState(false)
  return (
    <Section
      title="VoiceInput"
      description="A mic toggle whose ring follows the level, and a bar with cancel, a live waveform and a timer. A synthetic voice until you try your microphone; the page never asks on load."
    >
      <div className="flex w-full flex-col gap-group">
        <div className="flex items-center gap-items">
          <DemoVoiceInput variant="button" microphone={microphone} />
          <VoiceInput state="denied" labels={{ group: "Dictation denied", toggle: "Dictate again" }} />
          <VoiceInput state="processing" labels={{ group: "Dictation processing", toggle: "Dictate later" }} />
        </div>
        <DemoVoiceInput variant="bar" microphone={microphone} />
        <Toggle variant="outline" pressed={microphone} onPressedChange={setMicrophone} className="self-start">
          Try with your microphone
        </Toggle>
      </div>
    </Section>
  )
}

export { VoiceInputSection }
