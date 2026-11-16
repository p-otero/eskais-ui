"use client"

import {
  NavigationMenu as NavigationMenuPrimitive,
  NavigationMenuContent as NavigationMenuContentPrimitive,
  NavigationMenuIndicator as NavigationMenuIndicatorPrimitive,
  NavigationMenuItem,
  NavigationMenuLink as NavigationMenuLinkPrimitive,
  NavigationMenuLinkIcon as NavigationMenuLinkIconPrimitive,
  NavigationMenuList as NavigationMenuListPrimitive,
  NavigationMenuTrigger as NavigationMenuTriggerPrimitive,
  createNavigationMenuController,
} from "@ui-sdk/react/navigation-menu"
import { cva, type VariantProps } from "class-variance-authority"
import type { ComponentProps } from "react"

import { floatingSurfaceClassName } from "@/components/ui/popover"
import { cnState } from "@/lib/utils"

const itemClassName =
  "inline-flex h-control cursor-pointer items-center justify-center gap-inline rounded-control px-control-x text-sm font-medium whitespace-nowrap transition-colors outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-disabled:cursor-not-allowed data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0"

function NavigationMenu({ className, ...props }: ComponentProps<typeof NavigationMenuPrimitive>) {
  return (
    <NavigationMenuPrimitive
      className={cnState("relative flex max-w-max items-center data-nested:max-w-none", className)}
      {...props}
    />
  )
}

function NavigationMenuList({ className, ...props }: ComponentProps<typeof NavigationMenuListPrimitive>) {
  return (
    <NavigationMenuListPrimitive
      className={cnState(
        "m-0 flex list-none items-center gap-inline p-0 data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch",
        className,
      )}
      {...props}
    />
  )
}

function NavigationMenuTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof NavigationMenuTriggerPrimitive>) {
  return (
    <NavigationMenuTriggerPrimitive
      className={cnState(
        `${itemClassName} group/navigation-menu-trigger data-open:bg-accent data-open:text-accent-foreground`,
        className,
      )}
      {...props}
    >
      {(state) => (
        <>
          {typeof children === "function" ? children(state) : children}
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="size-3! transition-transform duration-panel ease-standard group-data-open/navigation-menu-trigger:rotate-180 motion-reduce:transition-none"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </>
      )}
    </NavigationMenuTriggerPrimitive>
  )
}

function NavigationMenuContent({ className, ...props }: ComponentProps<typeof NavigationMenuContentPrimitive>) {
  return (
    <NavigationMenuContentPrimitive
      className={cnState(
        `${floatingSurfaceClassName} max-h-(--available-height) w-max max-w-(--available-width) overflow-y-auto p-inline`,
        className,
      )}
      {...props}
    />
  )
}

const navigationMenuLinkVariants = cva("outline-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0", {
  variants: {
    variant: {
      panel:
        "flex flex-col gap-inline rounded-control px-inset-item py-inset-item text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring data-has-icon:flex-row data-has-icon:items-center data-current:font-semibold",
      top: `${itemClassName} data-current:bg-accent data-current:text-accent-foreground`,
    },
  },
  defaultVariants: { variant: "panel" },
})

function NavigationMenuLink({
  className,
  variant,
  ...props
}: ComponentProps<typeof NavigationMenuLinkPrimitive> & VariantProps<typeof navigationMenuLinkVariants>) {
  return (
    <NavigationMenuLinkPrimitive className={cnState(navigationMenuLinkVariants({ variant }), className)} {...props} />
  )
}

function NavigationMenuLinkIcon({ className, ...props }: ComponentProps<typeof NavigationMenuLinkIconPrimitive>) {
  return (
    <NavigationMenuLinkIconPrimitive
      className={cnState("inline-flex text-muted-foreground data-mirror:rtl:-scale-x-100", className)}
      {...props}
    />
  )
}

function NavigationMenuIndicator({ className, ...props }: ComponentProps<typeof NavigationMenuIndicatorPrimitive>) {
  return (
    <NavigationMenuIndicatorPrimitive
      className={cnState(
        "pointer-events-none absolute bottom-(--active-item-bottom) left-(--active-item-left) h-0.5 w-(--active-item-width) rounded-full bg-primary opacity-0 transition-all duration-panel ease-standard data-visible:opacity-100 motion-reduce:transition-none",
        className,
      )}
      {...props}
    />
  )
}

export {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuIndicator,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuLinkIcon,
  NavigationMenuList,
  NavigationMenuTrigger,
  createNavigationMenuController,
}
