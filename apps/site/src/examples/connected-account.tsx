import { CloudIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { ConnectedAccount, ConnectedAccountStatus, type ConnectedAccountText } from "@/components/ui/connected-account"
import { DeviceCodePrompt, type DeviceCodePromptText } from "@/components/ui/device-code-prompt"
import { RelativeTime } from "@/components/ui/relative-time"

const CODE_LIFETIME_MS = 10 * 60_000
const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS

const verificationUri = "https://provider.example/device"

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const text: ConnectedAccountText = {
  status: {
    connected: "Connected",
    pending: "Waiting for approval",
    expired: "Sign-in expired",
    disconnected: "Not connected",
  },
  connect: "Connect account",
  reconnect: "Sign in again",
  disconnect: "Disconnect",
  cancel: "Cancel sign-in",
  disconnectTitle: "Disconnect this account?",
  disconnectDescription: "Syncing stops until you connect it again.",
  disconnectConfirm: "Disconnect account",
  disconnectAgentConfirm: "Unlinks your account at the provider; syncing stops",
  error: "That didn't work. Try again.",
}

const promptText: DeviceCodePromptText = {
  instructions: (link) => <>Go to {link} and enter this code.</>,
  open: "Open sign-in page",
  expiresIn: (_ms, time) => `Code expires in ${time}`,
  expired: "This code has expired.",
}

const codes = ["WDJB-MJHT", "QKFR-TXPN", "HVLC-ZMRD"]

function newFlow(id: number) {
  return { id, code: codes[id % codes.length] ?? "WDJB-MJHT", expiresAt: Date.now() + CODE_LIFETIME_MS }
}

function LinkedAccount({ initial }: { initial: ConnectedAccountStatus }) {
  const [status, setStatus] = useState(initial)
  const [flow, setFlow] = useState(() => newFlow(0))
  const [times, setTimes] = useState(() => ({
    connectedAt: Date.now() - 12 * DAY_MS,
    refreshedAt: Date.now() - HOUR_MS,
    expiredAt: Date.now() - 2 * DAY_MS,
  }))

  const startSignIn = async () => {
    await wait(600)
    setFlow((current) => newFlow(current.id + 1))
    setStatus(ConnectedAccountStatus.pending)
  }

  const facts =
    status === ConnectedAccountStatus.connected || status === ConnectedAccountStatus.expired
      ? [
          { id: "account", label: "Account", value: "a•••@example.com" },
          { id: "plan", label: "Plan", value: "Team" },
          { id: "since", label: "Connected", value: <RelativeTime value={times.connectedAt} /> },
          {
            id: "refresh",
            label: status === ConnectedAccountStatus.expired ? "Expired" : "Last refresh",
            value: (
              <RelativeTime value={status === ConnectedAccountStatus.expired ? times.expiredAt : times.refreshedAt} />
            ),
          },
        ]
      : []

  return (
    <ConnectedAccount
      provider={{ name: "Cloud provider", logo: <CloudIcon /> }}
      status={status}
      description={
        status === ConnectedAccountStatus.disconnected
          ? "Link your account to sync files from the provider."
          : undefined
      }
      notice={
        status === ConnectedAccountStatus.expired
          ? {
              tone: "warning",
              title: "Syncing paused",
              description: "New files stay on the provider until you sign in again.",
            }
          : undefined
      }
      facts={facts}
      waiting={
        <DeviceCodePrompt
          key={flow.id}
          code={flow.code}
          verificationUri={verificationUri}
          verificationUriComplete={`${verificationUri}?user_code=${flow.code}`}
          expiresAt={flow.expiresAt}
          onExpire={() => setStatus(ConnectedAccountStatus.expired)}
          copyLink
          actions={
            <Button
              variant="ghost"
              className="narrow:w-full"
              onClick={() => {
                const now = Date.now()
                setTimes((current) => ({ ...current, connectedAt: now, refreshedAt: now }))
                setStatus(ConnectedAccountStatus.connected)
              }}
            >
              Simulate approval
            </Button>
          }
          text={promptText}
        />
      }
      onConnect={startSignIn}
      onReconnect={startSignIn}
      onCancel={async () => {
        await wait(400)
        setStatus(ConnectedAccountStatus.disconnected)
      }}
      onDisconnect={async () => {
        await wait(600)
        setStatus(ConnectedAccountStatus.disconnected)
      }}
      text={text}
    />
  )
}

export default function ConnectedAccountDemo() {
  return (
    <div className="grid w-full max-w-4xl items-start gap-section md:grid-cols-2">
      <LinkedAccount initial={ConnectedAccountStatus.pending} />
      <LinkedAccount initial={ConnectedAccountStatus.expired} />
    </div>
  )
}
