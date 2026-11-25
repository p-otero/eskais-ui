import { useState } from "react"

import { Button } from "@/components/ui/button"
import { VoiceInput, type VoiceInputState, type VoiceInputVariant } from "@/components/ui/voice-input"
import { requestMicrophone, stopStream } from "@/lib/microphone"

function LiveVoiceInput({ variant }: { variant: VoiceInputVariant }) {
  const [state, setState] = useState<VoiceInputState>("idle")
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [startedAt, setStartedAt] = useState<number>()

  const start = async () => {
    setState("requesting")
    const result = await requestMicrophone()
    if (result.state !== "listening") {
      setState(result.state)
      return
    }
    setStream(result.stream)
    setStartedAt(Date.now())
    setState("listening")
  }
  const release = () => {
    stopStream(stream)
    setStream(null)
  }

  return (
    <VoiceInput
      variant={variant}
      state={state}
      stream={stream}
      startedAt={startedAt}
      labels={{ group: `Live ${variant}` }}
      onStart={() => void start()}
      onConfirm={() => {
        release()
        setState("processing")
        setTimeout(() => setState("idle"), 1500)
      }}
      onCancel={() => {
        release()
        setState("idle")
      }}
    />
  )
}

const shown: VoiceInputState[] = ["idle", "processing", "error", "denied"]

function VoiceInputCheck() {
  const [mounted, setMounted] = useState(true)
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-section bg-background p-inset-surface text-foreground">
      <section aria-label="Live" className="flex flex-col gap-group">
        <Button variant="outline" className="self-start" onClick={() => setMounted(!mounted)}>
          {mounted ? "Remove live inputs" : "Add live inputs"}
        </Button>
        {mounted ? (
          <div className="flex items-center gap-group">
            <LiveVoiceInput variant="button" />
            <LiveVoiceInput variant="bar" />
          </div>
        ) : null}
      </section>
      <section aria-label="States" className="flex flex-col gap-items">
        {shown.map((state) => (
          <div key={state} className="flex items-center gap-group">
            <VoiceInput state={state} labels={{ group: `Still button ${state}` }} />
            <VoiceInput variant="bar" state={state} elapsed={42} labels={{ group: `Still bar ${state}` }} />
          </div>
        ))}
      </section>
    </main>
  )
}

export { VoiceInputCheck }
