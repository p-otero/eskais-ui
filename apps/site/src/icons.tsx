import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"

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

const SearchIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Icon>
)

const MoonIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
  </Icon>
)

const SunIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Icon>
)

const GithubIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" />
  </Icon>
)

const ArrowRightIcon = (props: IconProps) => (
  <Icon {...props} className={cn("rtl:-scale-x-100", props.className)}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
)

const ArrowLeftIcon = (props: IconProps) => (
  <Icon {...props} className={cn("rtl:-scale-x-100", props.className)}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Icon>
)

const CopyIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
  </Icon>
)

const CheckIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m5 12 5 5L20 7" />
  </Icon>
)

const BookIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 19.5V5a2 2 0 0 1 2-2h14v16H6.5a2.5 2.5 0 0 0 0 5H20" />
  </Icon>
)

const BoxIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m21 8-9-5-9 5v8l9 5 9-5Z" />
    <path d="m3 8 9 5 9-5M12 13v8" />
  </Icon>
)

const SparkIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.5 2.5M15.2 15.2l2.5 2.5M6.3 17.7l2.5-2.5M15.2 8.8l2.5-2.5" />
  </Icon>
)

function Logo(props: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" {...props}>
      <rect width="32" height="32" rx="9" className="fill-primary" />
      <path
        d="M10 10.5h12M10 16h8M10 21.5h12"
        className="stroke-primary-foreground"
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="22.5" cy="16" r="2.2" className="fill-primary-foreground" />
    </svg>
  )
}

export {
  ArrowLeftIcon,
  ArrowRightIcon,
  BookIcon,
  BoxIcon,
  CheckIcon,
  CopyIcon,
  GithubIcon,
  Logo,
  MoonIcon,
  SearchIcon,
  SparkIcon,
  SunIcon,
}
