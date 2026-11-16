import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

export default function AlertDemo() {
  return (
    <div className="grid w-full max-w-xl gap-items">
      <Alert tone="info">
        <AlertTitle>Builds are queued</AlertTitle>
        <AlertDescription>Three builds run ahead of yours.</AlertDescription>
      </Alert>
      <Alert tone="success">
        <AlertTitle>Deployed</AlertTitle>
        <AlertDescription>Apollo is live on the production domain.</AlertDescription>
      </Alert>
      <Alert
        tone="destructive"
        action={
          <Button size="sm" variant="outline">
            Retry
          </Button>
        }
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4m0 4h.01" />
        </svg>
        <AlertTitle>Deploy failed</AlertTitle>
        <AlertDescription>The build exited with code 1. See the log.</AlertDescription>
      </Alert>
    </div>
  )
}
