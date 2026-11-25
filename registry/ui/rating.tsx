"use client"

import {
  Rating as RatingPrimitive,
  RatingItem as RatingItemPrimitive,
  createRatingController,
} from "@ui-sdk/react/rating"
import type { ComponentProps, ComponentType, SVGProps } from "react"
import { StarIcon } from "lucide-react"

import { cnState } from "@/lib/utils"

type RatingSize = "sm" | "md" | "lg"

const sizeClassNames = {
  sm: "[--rating-size:1rem]",
  md: "[--rating-size:1.25rem]",
  lg: "[--rating-size:1.5rem]",
} satisfies Record<RatingSize, string>

type RatingProps = ComponentProps<typeof RatingPrimitive> & {
  size?: RatingSize
  /** The icon of each star, drawn twice: an outline, and a filled copy clipped to how much of the star is covered. */
  icon?: ComponentType<SVGProps<SVGSVGElement>>
}

/** Without children, each star is `icon` (a star by default), filled up to the score, half stars and averages too. */
function Rating({ className, size = "md", icon = StarIcon, children, ...props }: RatingProps) {
  return (
    <RatingPrimitive
      className={cnState(`inline-flex w-fit items-center ${sizeClassNames[size]} data-disabled:opacity-50`, className)}
      {...props}
    >
      {children ?? <RatingItem icon={icon} />}
    </RatingPrimitive>
  )
}

type RatingItemProps = ComponentProps<typeof RatingItemPrimitive> & {
  icon?: ComponentType<SVGProps<SVGSVGElement>>
}

const filledClassName =
  // oxlint-disable-next-line shadcn/no-arbitrary-values -- clips the filled star to --rating-fill from the inline end
  "fill-current [clip-path:inset(0_calc((1-var(--rating-fill,0))*100%)_0_0)] rtl:[clip-path:inset(0_0_0_calc((1-var(--rating-fill,0))*100%))]"

function RatingItem({ className, icon: Icon = StarIcon, children, ...props }: RatingItemProps) {
  return (
    <RatingItemPrimitive
      className={cnState(
        [
          "relative inline-flex size-[calc(var(--rating-size)+var(--gap-inline))] shrink-0 cursor-pointer items-center justify-center rounded-control text-input-strong",
          "pointer-coarse:size-(--control-height-touch) data-disabled:cursor-not-allowed data-readonly:cursor-default",
          "has-focus-visible:ring-2 has-focus-visible:ring-ring",
          "[&_svg]:size-(--rating-size)",
        ].join(" "),
        className,
      )}
      {...props}
    >
      {children ?? (
        <>
          <Icon aria-hidden />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center justify-center text-warning"
          >
            <Icon className={filledClassName} />
          </span>
        </>
      )}
    </RatingItemPrimitive>
  )
}

export { createRatingController, Rating, RatingItem }
export type { RatingItemProps, RatingProps, RatingSize }
export type { RatingController, RatingItemState, RatingState, RatingValueChangeReason } from "@ui-sdk/react/rating"
