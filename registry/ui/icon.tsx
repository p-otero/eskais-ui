import type { ComponentType, SVGAttributes } from "react"

import { cn } from "@/lib/utils"

type IconSvgProps = Omit<SVGAttributes<SVGSVGElement>, "children">

/** A lucide icon, or any component that renders an `<svg>` and passes these props to it. */
type IconComponent = ComponentType<IconSvgProps>

type IconProps = IconSvgProps & {
  icon: IconComponent
  /**
   * Makes the icon meaningful: `role="img"` with this accessible name, in the page's language. Use it only when
   * nothing else says what the icon means. Without it the icon is decorative and `aria-hidden`.
   */
  label?: string
}

/**
 * Renders an icon component as decorative or, with `label`, as a named image.
 *
 * Size comes from the parent (Button, Badge, menu items and inputs set `[&_svg]:size-4`) or from a `size-*` class:
 * `size-3.5` beside `text-body-sm` or `text-caption`, `size-4` beside `text-body`, `size-5` beside a title.
 * Colour is `currentColor`, so a text colour (`text-success`, `text-muted-foreground`) colours it.
 */
function Icon({ icon: Component, label, className, ...props }: IconProps) {
  const name = label ? { role: "img", "aria-label": label } : { "aria-hidden": true }
  return <Component data-slot="icon" className={cn("shrink-0", className)} {...name} {...props} />
}

export { Icon }
export type { IconComponent, IconProps }
