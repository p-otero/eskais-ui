import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"

export default function PopoverDemo() {
  return (
    <div className="flex flex-wrap items-center gap-items">
      <Popover>
        <PopoverTrigger>Attempt 2 details</PopoverTrigger>
        <PopoverContent>
          <PopoverTitle>Attempt 2</PopoverTitle>
          <PopoverDescription>Retried 30 seconds after a rate limit.</PopoverDescription>
          <dl className="grid grid-cols-2 gap-inline text-body-sm">
            <dt className="text-muted-foreground">Model</dt>
            <dd>claude-opus-5-5</dd>
            <dt className="text-muted-foreground">Tokens</dt>
            <dd>12,480</dd>
          </dl>
          <PopoverClose className="self-end">Done</PopoverClose>
        </PopoverContent>
      </Popover>
      <Popover openOnHover delay={300} closeDelay={200}>
        <PopoverTrigger variant="ghost">Retry policy</PopoverTrigger>
        <PopoverContent>
          <PopoverTitle>Retry policy</PopoverTitle>
          <PopoverDescription>
            Three tries, 30 seconds apart. Opens on hover, a press, Enter or a tap.
          </PopoverDescription>
          <PopoverClose className="self-end">Done</PopoverClose>
        </PopoverContent>
      </Popover>
    </div>
  )
}
