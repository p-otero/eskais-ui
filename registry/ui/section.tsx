import type { ComponentProps, ReactNode } from "react"

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardEyebrow,
  CardFooter,
  CardHeader,
  CardTitle,
  type CardHeadingLevel,
  type CardSurface,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

type SectionProps = Omit<ComponentProps<typeof Card>, "title" | "surface"> & {
  title: ReactNode
  eyebrow?: ReactNode
  description?: ReactNode
  /** A control at the top end of the header, like a Button or a menu trigger. */
  action?: ReactNode
  headingLevel?: CardHeadingLevel
  /** `card` (default), `none` for a titled group without a box, `dashed` for a "create" tile. */
  surface?: CardSurface
  /** `sm` tightens the inset for dense dashboards. Ignored without a surface. */
  padding?: "sm" | "md"
  footer?: ReactNode
  titleId?: string
}

function Section({
  title,
  eyebrow,
  description,
  action,
  headingLevel = 2,
  surface = "card",
  padding = "md",
  footer,
  titleId,
  className,
  children,
  ...props
}: SectionProps) {
  const small = padding === "sm" && surface !== "none"
  return (
    <Card
      data-padding={padding}
      surface={surface}
      className={cn(small && "py-group [&>[data-slot^=card-]]:px-group", className)}
      {...props}
    >
      <CardHeader>
        {eyebrow === undefined ? null : <CardEyebrow>{eyebrow}</CardEyebrow>}
        <CardTitle headingLevel={headingLevel} id={titleId}>
          {title}
        </CardTitle>
        {description === undefined ? null : <CardDescription>{description}</CardDescription>}
        {action === undefined ? null : <CardAction>{action}</CardAction>}
      </CardHeader>
      {children === undefined ? null : <CardContent>{children}</CardContent>}
      {footer === undefined ? null : <CardFooter>{footer}</CardFooter>}
    </Card>
  )
}

export { Section }
export type { SectionProps }
