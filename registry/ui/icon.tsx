import type { ComponentType, SVGAttributes } from "react"

import { cn } from "@/lib/utils"

type IconSvgProps = Omit<SVGAttributes<SVGSVGElement>, "children">

/** Any component that renders an `<svg>` and passes these props to it, like a lucide icon. */
type IconComponent = ComponentType<IconSvgProps>

type IconProps = IconSvgProps & {
  icon: IconComponent
  /** Gives the icon `role="img"` with this accessible name; without it the icon is decorative and `aria-hidden`. */
  label?: string
}

function Icon({ icon: Component, label, className, ...props }: IconProps) {
  const name = label ? { role: "img", "aria-label": label } : { "aria-hidden": true }
  return <Component data-slot="icon" className={cn("shrink-0", className)} {...name} {...props} />
}

export { Icon }
export type { IconComponent, IconProps }
