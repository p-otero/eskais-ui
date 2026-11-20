import { useRef, useState } from "react"

import { ArrowRightIcon } from "lucide-react"
import { Link } from "@/components/ui/link"

type Followed = { name: string; how: string }

function describe(event: Event | undefined, pressedAt: number | undefined) {
  if (event?.type === "pointerdown") return "on mouse press, before you let go"
  if (event instanceof MouseEvent && event.detail === 0) return "with the keyboard"
  if (pressedAt === undefined) return "on release"
  return `on release, ${String(Math.round(performance.now() - pressedAt))} ms after the press`
}

export default function LinkDemo() {
  const [followed, setFollowed] = useState<Followed>()
  const pressedAt = useRef<number>(undefined)
  const follow = (name: string) => (_href: string, details: { event?: Event }) => {
    setFollowed({ name, how: describe(details.event, pressedAt.current) })
    pressedAt.current = undefined
  }
  const press = () => {
    pressedAt.current = performance.now()
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-group">
      <div className="flex flex-col gap-items">
        <p className="text-body-sm text-muted-foreground">
          Press and hold each link with the mouse. The fast link follows the moment the button goes down; the other
          waits until you let go. Tab to them and press Enter to follow with the keyboard.
        </p>
        <nav aria-label="Follow test" className="flex flex-wrap gap-group">
          <Link variant="standalone" href="#/link-demo/fast" onPointerDown={press} onFollow={follow("Fast link")}>
            Fast link
            <ArrowRightIcon className="rtl:-scale-x-100" />
          </Link>
          <Link
            variant="standalone"
            href="#/link-demo/release"
            fast={false}
            onPointerDown={press}
            onFollow={follow("fast={false}")}
          >
            fast={"{false}"}
            <ArrowRightIcon className="rtl:-scale-x-100" />
          </Link>
        </nav>
        <p
          data-testid="link-demo-result"
          className="rounded-control border bg-muted px-inset-item py-inset-item text-body-sm"
          aria-live="polite"
        >
          {followed ? (
            <>
              Followed <span className="font-medium">{followed.name}</span> {followed.how}.
            </>
          ) : (
            "Nothing followed yet."
          )}
        </p>
      </div>
      <div className="flex flex-col gap-items border-t pt-group">
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
      </div>
    </div>
  )
}
