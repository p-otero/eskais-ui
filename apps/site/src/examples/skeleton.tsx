import { Skeleton } from "@/components/ui/skeleton"

export default function SkeletonDemo() {
  return (
    <div className="flex w-full max-w-sm items-center gap-items" aria-busy="true">
      <Skeleton className="size-10 rounded-full" />
      <div className="flex flex-1 flex-col gap-inline">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  )
}
