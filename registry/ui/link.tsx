"use client"

import { renderElement, usePart, usePrimitive, type PartProps } from "@ui-sdk/react/primitive"
import { cva } from "class-variance-authority"
import type { AriaAttributes, ReactNode } from "react"

import { link, type LinkOptions } from "@/components/ui/link-primitive"
import { cn } from "@/lib/utils"

type LinkVariant = "inline" | "nav" | "muted" | "standalone" | "plain"

const focusRing =
  "rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"

// `plain` adds nothing, not even the focus ring, so a row or card styled through className keeps its own.
const linkVariants = cva("", {
  variants: {
    variant: {
      inline: "text-link underline decoration-1 underline-offset-2 hover:decoration-2",
      nav: "text-muted-foreground underline-offset-4 transition-colors duration-micro ease-standard hover:text-foreground hover:underline aria-[current]:font-medium aria-[current]:text-foreground",
      muted:
        "text-muted-foreground underline-offset-2 transition-colors duration-micro ease-standard hover:text-foreground hover:underline",
      standalone:
        "touch-target inline-flex items-center gap-inline font-medium text-link underline-offset-4 hover:underline [&_svg]:size-4 [&_svg]:shrink-0",
      plain: "",
    },
  },
  compoundVariants: [{ variant: ["inline", "nav", "muted", "standalone"], class: focusRing }],
  defaultVariants: { variant: "inline" },
})

type LinkProps = Omit<PartProps<"a">, "children"> & {
  children?: ReactNode
  /**
   * `inline` sits in running text (underlined at rest), `nav` and `muted` list links (underlined on hover),
   * `standalone` is a call to action on its own line, `plain` leaves the look to `className` (a card, a row).
   */
  variant?: LinkVariant
  /** Another site: a trailing icon and `rel="noopener noreferrer"`. Opens in the same tab unless `newTab`. */
  external?: boolean
  /** Opens in a new tab (`target="_blank"`) and says so to screen readers with `newTabLabel`. */
  newTab?: boolean
  newTabLabel?: string
  /** Marks the link to the current page (`aria-current="page"`), or pass another `aria-current` token. */
  current?: boolean | Exclude<AriaAttributes["aria-current"], boolean | "true" | "false">
  /**
   * Takes over a plain click (modified clicks keep the browser's behaviour), for client-side routing. It also
   * offers agents a `follow` action that calls it; links without it are invisible to agents.
   */
  onFollow?: LinkOptions["onFollow"]
}

function ExternalIcon() {
  return (
    <svg
      data-slot="link-external-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="ms-px inline-block size-3 shrink-0 align-baseline rtl:-scale-x-100"
    >
      <path d="M7 17 17 7M8 7h9v9" />
    </svg>
  )
}

function linkProps({
  variant = "inline",
  external = false,
  newTab = false,
  newTabLabel = "(opens in a new tab)",
  current,
  className,
  children,
  rel,
  target,
  ...props
}: Omit<LinkProps, "onFollow" | "render">) {
  return {
    "data-slot": "link",
    "data-variant": variant,
    "data-external": external ? "" : undefined,
    "aria-current": current === true ? ("page" as const) : current || undefined,
    rel: external ? ["noopener noreferrer", rel].filter(Boolean).join(" ") : rel,
    target: newTab ? "_blank" : target,
    className: cn(linkVariants({ variant }), className),
    children: (
      <>
        {children}
        {external && <ExternalIcon />}
        {newTab && <span className="sr-only"> {newTabLabel}</span>}
      </>
    ),
    ...props,
  }
}

function FollowLink({ onFollow, render, ...props }: LinkProps) {
  const handle = usePrimitive(link, { href: props.href, onFollow })
  return usePart(handle, "root", {}, { ...linkProps(props), render }, "a")
}

function Link({ onFollow, render, ...props }: LinkProps) {
  if (onFollow) return <FollowLink onFollow={onFollow} render={render} {...props} />
  return renderElement("a", linkProps(props), render)
}

export { Link, linkVariants }
export type { LinkProps, LinkVariant }
