import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"

export default function HoverCardDemo() {
  return (
    <p className="text-body">
      Reviewed by{" "}
      <HoverCard>
        <HoverCardTrigger href="#reviewer">reviewer</HoverCardTrigger>
        <HoverCardContent>
          <p className="font-medium">Reviewer agent</p>
          <p className="text-muted-foreground">Checks each result against its acceptance criteria.</p>
        </HoverCardContent>
      </HoverCard>
    </p>
  )
}
