import { useId, type ComponentProps, type ReactNode } from "react"

import { CodeBlock } from "@/components/ui/code-block"
import { cn } from "@/lib/utils"

type HeroProps = Omit<ComponentProps<"section">, "title"> & {
  /** Shown as a chip above the title. */
  eyebrow?: ReactNode
  title: ReactNode
  /** A second line of the title, in the muted colour. */
  titleMuted?: ReactNode
  /** `false` lets the muted part continue the title's line instead of starting its own. */
  titleBreak?: boolean
  description?: ReactNode
  actions?: ReactNode
  /** Beside the text on wide containers, below it on narrow ones. */
  aside?: ReactNode
  /** A shell command, shown in a copyable CodeBlock below the actions. */
  install?: string
  installLabel?: string
  align?: "start" | "center"
  /** `grid` draws faint grid lines that fade out behind the hero; `glow` adds a wash from the link colour. */
  decoration?: "grid" | "glow" | "none"
  headingLevel?: 1 | 2
}

function Hero({
  eyebrow,
  title,
  titleMuted,
  titleBreak = true,
  description,
  actions,
  aside,
  install,
  installLabel = "Install command",
  align = "start",
  decoration = "grid",
  headingLevel = 1,
  className,
  "aria-labelledby": labelledBy,
  ...props
}: HeroProps) {
  const titleId = useId()
  const Heading = `h${headingLevel}` as const
  const centered = align === "center"
  return (
    <section
      data-slot="hero"
      data-align={align}
      aria-labelledby={labelledBy ?? titleId}
      className={cn("@container relative isolate w-full", className)}
      {...props}
    >
      {decoration !== "none" && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          {decoration === "glow" && <div className="absolute inset-0 bg-glow" />}
          <div className="absolute inset-0 bg-grid-lines" />
        </div>
      )}
      <div
        className={cn(
          "grid items-center gap-section py-section",
          aside !== undefined && !centered && "@4xl:grid-cols-2",
          centered && "justify-items-center text-center",
        )}
      >
        <div
          data-slot="hero-content"
          className={cn(
            "flex min-w-0 flex-col gap-group transition duration-dialog ease-standard starting:translate-y-3 starting:opacity-0",
            centered && "max-w-3xl items-center",
          )}
        >
          {eyebrow !== undefined && (
            <p
              data-slot="hero-eyebrow"
              className="flex w-fit items-center gap-inline rounded-full border bg-card px-inset-chip py-inset-chip text-caption text-muted-foreground"
            >
              {eyebrow}
            </p>
          )}
          <Heading
            id={titleId}
            data-slot="hero-title"
            className="text-4xl leading-tight font-semibold tracking-tight text-balance @xl:text-5xl"
          >
            {title}
            {titleMuted !== undefined && (
              <>
                {" "}
                <span className={cn("text-muted-foreground", titleBreak && "block")}>{titleMuted}</span>
              </>
            )}
          </Heading>
          {description !== undefined && (
            <p
              data-slot="hero-description"
              className="max-w-xl text-body text-pretty text-muted-foreground @xl:text-lg/7"
            >
              {description}
            </p>
          )}
          {actions !== undefined && (
            <div
              data-slot="hero-actions"
              className={cn("flex flex-wrap items-center gap-items", centered && "justify-center")}
            >
              {actions}
            </div>
          )}
          {install !== undefined && (
            <CodeBlock
              code={install}
              language="bash"
              aria-label={installLabel}
              className="w-full max-w-md text-start"
            />
          )}
        </div>
        {aside !== undefined && (
          <div
            data-slot="hero-aside"
            className="min-w-0 transition duration-dialog ease-standard starting:translate-y-4 starting:opacity-0 @4xl:pt-section"
          >
            {aside}
          </div>
        )}
      </div>
    </section>
  )
}

export { Hero }
export type { HeroProps }
