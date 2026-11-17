import {
  Carousel,
  CarouselContent,
  CarouselIndicator,
  CarouselIndicatorGroup,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  CarouselStatus,
  CarouselViewport,
} from "@/components/ui/carousel"

const projects = ["Apollo", "Borealis", "Cygnus", "Draco"]

export default function CarouselDemo() {
  return (
    <Carousel aria-label="Featured projects" className="w-full max-w-md">
      <div className="flex items-baseline justify-between">
        <h3 className="text-title-sm">Featured projects</h3>
        <CarouselStatus />
      </div>
      <CarouselViewport>
        <CarouselContent>
          {projects.map((name) => (
            <CarouselItem key={name}>
              <div className="flex h-32 items-center justify-center rounded-surface bg-muted text-title">{name}</div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </CarouselViewport>
      <div className="flex items-center justify-between">
        <CarouselPrevious />
        <CarouselIndicatorGroup aria-label="Choose a project">
          {projects.map((name, index) => (
            <CarouselIndicator key={name} page={index + 1} />
          ))}
        </CarouselIndicatorGroup>
        <CarouselNext />
      </div>
    </Carousel>
  )
}
