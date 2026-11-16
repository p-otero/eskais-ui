import { Children, createContext, use, type ComponentProps, type CSSProperties, type ReactNode } from "react"

import { cn } from "@/lib/utils"

const StepNumber = createContext(0)

type StepsProps = ComponentProps<"ol"> & {
  /** `auto` lays the steps side by side on a wide container (48rem and up) and stacks them below. */
  orientation?: "auto" | "vertical" | "horizontal"
}

/** Numbered steps as an ordered list, so screen readers count them too; the markers repeat the numbers visually. */
function Steps({ orientation = "auto", className, style, children, ...props }: StepsProps) {
  const count = Children.toArray(children).length
  return (
    <div data-slot="steps-container" className="@container w-full min-w-0">
      <ol
        data-slot="steps"
        data-orientation={orientation}
        className={cn(
          "grid list-none gap-group",
          orientation === "horizontal" && "grid-cols-(--steps-columns) gap-items",
          orientation === "auto" && "@3xl:grid-cols-(--steps-columns) @3xl:gap-items",
          className,
        )}
        style={{ ...style, "--steps-columns": `repeat(${count}, minmax(0, 1fr))` } as CSSProperties}
        {...props}
      >
        {Children.map(children, (child, index) => (
          <StepNumber value={index + 1}>{child}</StepNumber>
        ))}
      </ol>
    </div>
  )
}

type StepProps = Omit<ComponentProps<"li">, "title"> & {
  title: ReactNode
  description?: ReactNode
  headingLevel?: 2 | 3 | 4
  /** Anything that belongs to the step, like a CodeBlock; it fills the remaining height. */
  children?: ReactNode
}

function Step({ title, description, headingLevel = 3, className, children, ...props }: StepProps) {
  const Heading = `h${headingLevel}` as const
  const number = use(StepNumber)
  return (
    <li data-slot="step" className={cn("flex min-w-0 flex-col gap-items", className)} {...props}>
      <div className="flex items-center gap-items">
        <span
          data-slot="step-marker"
          aria-hidden="true"
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-caption text-primary-foreground"
        >
          {number}
        </span>
        <Heading data-slot="step-title" className="text-title-sm tracking-tight">
          {title}
        </Heading>
      </div>
      {description !== undefined && (
        <p data-slot="step-description" className="text-body-sm text-pretty text-muted-foreground">
          {description}
        </p>
      )}
      {children !== undefined && <div className="flex min-w-0 flex-1 flex-col gap-items">{children}</div>}
    </li>
  )
}

export { Step, Steps }
export type { StepProps, StepsProps }
