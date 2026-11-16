import { useState } from "react"

import { Link } from "@/components/ui/link"

export default function LinkDemo() {
  const [followed, setFollowed] = useState<string>()
  return (
    <div className="flex w-full max-w-md flex-col gap-group">
      <p className="text-body">
        Read the <Link href="#install">installation guide</Link> first, then browse the{" "}
        <Link href="https://ui-sdk.dev/docs" external newTab>
          UI SDK docs
        </Link>
        .
      </p>
      <nav aria-label="Project" className="flex flex-wrap gap-group text-body-sm">
        <Link variant="nav" href="#overview" current>
          Overview
        </Link>
        <Link variant="nav" href="#activity">
          Activity
        </Link>
        <Link variant="nav" href="#settings">
          Settings
        </Link>
      </nav>
      <div className="flex flex-col gap-inline">
        <Link variant="standalone" href="#changelog" onFollow={(href) => setFollowed(href)}>
          Read the changelog
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M5 12h14m-6-6 6 6-6 6" />
          </svg>
        </Link>
        <p className="text-caption text-muted-foreground" aria-live="polite">
          {followed ? `onFollow got ${followed}` : "This one routes through onFollow, so agents can follow it too."}
        </p>
      </div>
    </div>
  )
}
