import type { ComponentProps } from "react"

import symbol from "./brand/eskais-symbol.svg?raw"

type IconProps = ComponentProps<"svg">

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  )
}

const GithubIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" />
  </Icon>
)

const symbolViewBox = /viewBox="([^"]+)"/.exec(symbol)?.[1]
const symbolPath = / d="([^"]+)"/.exec(symbol)?.[1]

/**
 * The Eskais "Ribbon Slash" symbol, in the text colour. Brand rules: monochrome, symbol only between 16 and 64px,
 * never animated. It is named "Eskais" unless `aria-hidden`, for when text beside it already names it.
 */
function Logo({ "aria-hidden": hidden, ...props }: Omit<IconProps, "children">) {
  const name = hidden ? { "aria-hidden": hidden } : { role: "img", "aria-label": "Eskais" }
  return (
    <svg
      viewBox={symbolViewBox}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="40"
      strokeLinejoin="round"
      {...name}
      {...props}
    >
      <path d={symbolPath} />
    </svg>
  )
}

export { GithubIcon, Logo }
