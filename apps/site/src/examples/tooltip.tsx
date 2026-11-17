import { CopyIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipShortcut, TooltipTrigger } from "@/components/ui/tooltip"

export default function TooltipDemo() {
  return (
    <div className="flex items-center gap-items">
      <Button variant="outline" size="icon" aria-label="Copy model ID">
        <CopyIcon />
      </Button>
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
