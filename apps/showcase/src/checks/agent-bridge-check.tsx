import { useState } from "react"

import { ImageScan, type ImageScanStatus } from "@/components/ui/image-scan"
import { VoiceInput, type VoiceInputState, type VoiceInputStateDetails } from "@/components/ui/voice-input"

// oxlint-disable-next-line import/no-unassigned-import -- registers the showcase's WebMCP tools on this page, which loads without the rest of the showcase
import "../agent"
import { stillLife } from "../sections/image-scan-fixtures"

const peopleOnly = (details: { source: string; cancel: () => void }) => {
  if (details.source === "agent") details.cancel()
}

function Dictation({ label, agents }: { label: string; agents: boolean }) {
  const [state, setState] = useState<VoiceInputState>("idle")
  return (
    <VoiceInput
      variant="bar"
      state={state}
      elapsed={0}
      labels={{ group: label }}
      onStateChange={(next: VoiceInputState, details: VoiceInputStateDetails) => {
        if (!agents) peopleOnly(details)
        if (!details.canceled) setState(next === "requesting" ? "listening" : next === "processing" ? "idle" : next)
      }}
    />
  )
}

function Scan({ alt, agents }: { alt: string; agents: boolean }) {
  const [status, setStatus] = useState<ImageScanStatus>("scanning")
  return (
    <ImageScan
      src={stillLife}
      alt={alt}
      width={800}
      height={600}
      status={status}
      onScan={() => setStatus("scanning")}
      onCancel={(details) => {
        if (!agents) peopleOnly(details)
        if (!details.canceled) setStatus("uploaded")
      }}
    />
  )
}

// ?demo=agent-bridge-check: controls an app lets only people use beside ones agents may use too, for
// tooling/agent-bridge-check.mjs, which drives them through the page's WebMCP tools from outside the page.
function AgentBridgeCheck() {
  return (
    <main className="flex flex-wrap items-start gap-section p-group">
      <section aria-label="Dictation" className="flex flex-col gap-items">
        <Dictation label="Dictation for people" agents={false} />
        <Dictation label="Dictation for everyone" agents />
      </section>
      <section aria-label="Scans" className="flex w-full max-w-sm flex-col gap-items">
        <Scan alt="Scan for people" agents={false} />
        <Scan alt="Scan for everyone" agents />
      </section>
    </main>
  )
}

export { AgentBridgeCheck }
