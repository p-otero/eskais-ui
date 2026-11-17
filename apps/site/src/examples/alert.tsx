import { CircleExclamationPointIcon } from "lucide-react"
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
        <CircleExclamationPointIcon />
        <AlertTitle>Deploy failed</AlertTitle>
        <AlertDescription>The build exited with code 1. See the log.</AlertDescription>
      </Alert>
    </div>
  )
}
