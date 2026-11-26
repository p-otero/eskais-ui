import { CircleCheckIcon, KeyRoundIcon, ShieldCheckIcon } from "lucide-react"
import { useState, type CSSProperties } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { AuthPage, type AuthStatus } from "@/components/ui/auth-page"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Link } from "@/components/ui/link"
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@/components/ui/segmented-control"

type Flow = "sign-in" | "register" | "recover"

const flows: Flow[] = ["sign-in", "register", "recover"]

const isFlow = (value: string | null): value is Flow => flows.some((flow) => flow === value)

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function Logo() {
  return (
    <span className="inline-flex items-center gap-inline text-title-sm">
      <span className="inline-flex size-control items-center justify-center rounded-control bg-primary text-primary-foreground">
        <ShieldCheckIcon className="size-5" />
      </span>
      Northwind
    </span>
  )
}

function useCeremony() {
  const [status, setStatus] = useState<AuthStatus>("idle")
  const [attempt, setAttempt] = useState(0)
  const run = async () => {
    setStatus("working")
    await wait(1200)
    setAttempt((count) => count + 1)
    setStatus(attempt === 0 ? "error" : "success")
  }
  const reset = () => {
    setStatus("idle")
    setAttempt(0)
  }
  return { status, run, reset }
}

const footer = (
  <>
    <Link href="#/terms">Terms</Link>
    <Link href="#/privacy">Privacy</Link>
    <Link href="#/help">Help</Link>
  </>
)

function SignIn({ onFlow }: { onFlow: (flow: Flow) => void }) {
  const ceremony = useCeremony()
  return (
    <AuthPage
      logo={<Logo />}
      title="Sign in to Northwind"
      description="Use the passkey saved on this device or your phone."
      status={ceremony.status}
      action={{
        label: "Sign in with a passkey",
        icon: <KeyRoundIcon />,
        onAction: () => ceremony.run(),
      }}
      workingLabel="Waiting for your passkey"
      error="The passkey request was cancelled or timed out."
      retry={{ label: "Try again" }}
      success={
        <Alert tone="success">
          <CircleCheckIcon />
          <AlertDescription className="text-foreground">
            You're signed in. Taking you to your workspace…
          </AlertDescription>
        </Alert>
      }
      secondary={
        <Button variant="link" onClick={() => onFlow("recover")}>
          Lost your passkey? Recover your account
        </Button>
      }
      footer={footer}
      style={{ "--auth-page-height": "auto" } as CSSProperties}
    />
  )
}

function Register() {
  const ceremony = useCeremony()
  const [name, setName] = useState("Ana Ruiz")
  return (
    <AuthPage
      logo={<Logo />}
      title="Join the Studio workspace"
      description="Create a passkey to finish setting up your account."
      status={ceremony.status}
      alert={
        <Alert tone="info">
          <AlertDescription className="text-foreground">
            Leo Park invited you as an Editor. This link works once and expires in 2 days.
          </AlertDescription>
        </Alert>
      }
      action={{
        label: "Create a passkey",
        icon: <KeyRoundIcon />,
        disabled: name.trim() === "",
        onAction: () => ceremony.run(),
      }}
      workingLabel="Waiting for your new passkey"
      error="The passkey wasn't saved. Your invitation still works."
      retry={{ label: "Try again" }}
      success={
        <Alert tone="success">
          <CircleCheckIcon />
          <AlertDescription className="text-foreground">Your account is ready.</AlertDescription>
        </Alert>
      }
      footer={footer}
      style={{ "--auth-page-height": "auto" } as CSSProperties}
    >
      {ceremony.status === "success" ? null : (
        <Field>
          <FieldLabel>Your name</FieldLabel>
          <Input value={name} onValueChange={setName} autoComplete="name" />
        </Field>
      )}
    </AuthPage>
  )
}

function Recover({ onFlow }: { onFlow: (flow: Flow) => void }) {
  const ceremony = useCeremony()
  return (
    <AuthPage
      logo={<Logo />}
      title="Recover your account"
      description="Enter a recovery code, then save a new passkey on this device."
      status={ceremony.status}
      action={{ label: "Recover and create a passkey", onAction: () => ceremony.run() }}
      workingLabel="Checking your recovery code"
      error="That recovery code didn't match. Each code works once."
      retry={{ label: "Try again" }}
      success={
        <Alert tone="success">
          <CircleCheckIcon />
          <AlertDescription className="text-foreground">Recovered. Your old passkeys were signed out.</AlertDescription>
        </Alert>
      }
      secondary={
        <Button variant="link" onClick={() => onFlow("sign-in")}>
          Back to sign in
        </Button>
      }
      footer={footer}
      style={{ "--auth-page-height": "auto" } as CSSProperties}
    >
      {ceremony.status === "success" ? null : (
        <Field>
          <FieldLabel>Recovery code</FieldLabel>
          <Input autoComplete="one-time-code" spellCheck={false} className="font-mono" />
        </Field>
      )}
    </AuthPage>
  )
}

export default function AuthPageDemo() {
  const [flow, setFlow] = useState<Flow>(() => {
    const requested = new URLSearchParams(location.search).get("flow")
    return isFlow(requested) ? requested : "sign-in"
  })
  return (
    <div className="flex w-full flex-col items-center gap-group">
      <SegmentedControl aria-label="Flow" value={flow} onValueChange={(next) => next && setFlow(next)}>
        <SegmentedControlIndicator />
        <SegmentedControlItem value="sign-in">Sign in</SegmentedControlItem>
        <SegmentedControlItem value="register">Register</SegmentedControlItem>
        <SegmentedControlItem value="recover">Recover</SegmentedControlItem>
      </SegmentedControl>
      {flow === "sign-in" ? <SignIn key="sign-in" onFlow={setFlow} /> : null}
      {flow === "register" ? <Register key="register" /> : null}
      {flow === "recover" ? <Recover key="recover" onFlow={setFlow} /> : null}
    </div>
  )
}
