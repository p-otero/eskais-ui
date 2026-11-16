import type { ReactNode } from "react"

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

function HomeIcon() {
  return (
    <Icon>
      <path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9Z" />
    </Icon>
  )
}

function FolderIcon() {
  return (
    <Icon>
      <path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z" />
    </Icon>
  )
}

function RocketIcon() {
  return (
    <Icon>
      <path d="M5 15c-1.5 1-2 4-2 6 2 0 5-.5 6-2M14 4c3-1 6-1 6-1s0 3-1 6l-7 7-5-5 7-7ZM15 9h.01" />
    </Icon>
  )
}

function BotIcon() {
  return (
    <Icon>
      <rect x="4" y="8" width="16" height="12" rx="2" />
      <path d="M12 4v4M9 13h.01M15 13h.01" />
    </Icon>
  )
}

function BellIcon() {
  return (
    <Icon>
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0" />
    </Icon>
  )
}

function ChartIcon() {
  return (
    <Icon>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </Icon>
  )
}

function GearIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" />
    </Icon>
  )
}

function DotsIcon() {
  return (
    <Icon>
      <path d="M5 12h.01M12 12h.01M19 12h.01" />
    </Icon>
  )
}

export { BellIcon, BotIcon, ChartIcon, DotsIcon, FolderIcon, GearIcon, HomeIcon, RocketIcon }
