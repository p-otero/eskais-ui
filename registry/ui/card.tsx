import { renderElement, type PartProps } from "@ui-sdk/react/primitive"

import { cn } from "@/lib/utils"

function part(slot: string, base: string) {
  return function CardPart({ className, render, ...props }: PartProps<"div">) {
    return renderElement("div", { "data-slot": slot, className: cn(base, className), ...props }, render)
  }
}

const Card = part(
  "card",
  "flex flex-col gap-surface rounded-surface border bg-card/(--glass-opacity) py-surface text-card-foreground shadow-surface backdrop-surface",
)
const CardHeader = part("card-header", "flex flex-col gap-1.5 px-surface")
const CardTitle = part("card-title", "leading-none font-semibold")
const CardDescription = part("card-description", "text-sm text-muted-foreground")
const CardContent = part("card-content", "px-surface")
const CardFooter = part("card-footer", "flex items-center gap-2 px-surface")

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle }
