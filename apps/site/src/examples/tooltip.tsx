import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipShortcut, TooltipTrigger } from "@/components/ui/tooltip"

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  )
}

export default function TooltipDemo() {
  return (
    <div className="flex items-center gap-items">
      <Tooltip>
        <TooltipTrigger render={<Button variant="outline" size="icon" aria-label="Copy model ID" />}>
          <CopyIcon />
        </TooltipTrigger>
        <TooltipContent>Copy model ID</TooltipContent>
      </Tooltip>
      <Tooltip shortcut="mod+e">
        <TooltipTrigger render={<Button variant="ghost" />}>Estimate</TooltipTrigger>
        <TooltipContent>
          About $0.42 for 12k tokens
          <TooltipShortcut />
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
