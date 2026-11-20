import { useState } from "react"

import { Link } from "@/components/ui/link"
import { SkipLink } from "@/components/ui/skip-link"

const sections = ["Inbox", "Projects", "Reports", "Settings"]

// The skip link is fixed to the viewport. A transform makes this frame its containing block, so in the
// preview it shows at the frame's top corner, where the person is looking, instead of over the site header. A click
// focuses the frame (tabIndex -1) rather than the page's <main>, so the next Tab reaches the skip link.
export default function SkipLinkDemo() {
  const [skipped, setSkipped] = useState(false)
  return (
    <div className="flex w-full max-w-md flex-col gap-items">
      <p className="text-body-sm text-muted-foreground">
        Click inside the frame below, then press Tab: the skip link appears at its top corner. Press Enter on it to jump
        past the navigation.
      </p>
      <div
        data-testid="skip-link-frame"
        tabIndex={-1}
        className="flex flex-col gap-group rounded-surface border bg-background p-inset-surface transform-gpu outline-none"
      >
        <SkipLink href="#skip-link-demo-content">Skip to content</SkipLink>
        <nav aria-label="Demo sections" className="flex flex-wrap gap-group text-body-sm">
          {sections.map((section) => (
            <Link key={section} variant="nav" href={`#/skip-link-demo/${section.toLowerCase()}`} onFollow={() => {}}>
              {section}
            </Link>
          ))}
        </nav>
        <div
          id="skip-link-demo-content"
          className="flex flex-col gap-inline rounded-control text-body outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          onFocus={() => setSkipped(true)}
          onBlur={() => setSkipped(false)}
        >
          <p className="text-title-sm">Content</p>
          <p className="text-body-sm text-muted-foreground" aria-live="polite">
            {skipped
              ? "Focus is here now: the next Tab goes to the content, not back through the navigation."
              : "Without the skip link, a keyboard user tabs through every navigation link to get here."}
          </p>
        </div>
      </div>
    </div>
  )
}
