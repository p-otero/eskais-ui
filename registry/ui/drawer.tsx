"use client"

import {
  Drawer,
  DrawerBackdrop as DrawerBackdropPrimitive,
  DrawerClose as DrawerClosePrimitive,
  DrawerContent as DrawerContentPrimitive,
  DrawerDescription as DrawerDescriptionPrimitive,
  DrawerHandle as DrawerHandlePrimitive,
  DrawerTitle as DrawerTitlePrimitive,
  DrawerTrigger as DrawerTriggerPrimitive,
  createDrawerController,
} from "@ui-sdk/react/drawer"
import { renderElement, type PartProps } from "@ui-sdk/react/primitive"
import type { VariantProps } from "class-variance-authority"
import type { ComponentProps } from "react"

import { buttonVariants } from "@/components/ui/button"
import { cn, cnState } from "@/lib/utils"

type ButtonLook = VariantProps<typeof buttonVariants>

// The drawer drives the content's translate and the backdrop's opacity itself, so neither is styled here.
const drawerBackdropClassName = "fixed inset-0 z-50 bg-overlay"

const drawerContentClassName = [
  "flex flex-col gap-group overflow-y-auto overscroll-contain border border-floating-border bg-popover/(--glass-opacity) p-inset-surface text-popover-foreground shadow-floating backdrop-floating outline-none",
  "data-[side=bottom]:mx-auto data-[side=bottom]:max-h-[calc(100%-2rem)] data-[side=bottom]:w-full data-[side=bottom]:max-w-2xl data-[side=bottom]:rounded-t-surface data-[side=bottom]:border-b-0",
  "data-[side=top]:mx-auto data-[side=top]:max-h-[calc(100%-2rem)] data-[side=top]:w-full data-[side=top]:max-w-2xl data-[side=top]:rounded-b-surface data-[side=top]:border-t-0",
  "data-[side=right]:h-full data-[side=right]:w-[calc(100%-2rem)] data-[side=right]:max-w-sm data-[side=right]:rounded-l-surface data-[side=right]:border-r-0",
  "data-[side=left]:h-full data-[side=left]:w-[calc(100%-2rem)] data-[side=left]:max-w-sm data-[side=left]:rounded-r-surface data-[side=left]:border-l-0",
].join(" ")

function DrawerTrigger({
  className,
  variant = "outline",
  size,
  ...props
}: ComponentProps<typeof DrawerTriggerPrimitive> & ButtonLook) {
  return <DrawerTriggerPrimitive className={cnState(buttonVariants({ variant, size }), className)} {...props} />
}

function DrawerBackdrop({ className, ...props }: ComponentProps<typeof DrawerBackdropPrimitive>) {
  return <DrawerBackdropPrimitive className={cnState(drawerBackdropClassName, className)} {...props} />
}

function DrawerContent({ className, ...props }: ComponentProps<typeof DrawerContentPrimitive>) {
  return <DrawerContentPrimitive className={cnState(drawerContentClassName, className)} {...props} />
}

function DrawerHandle({ className, ...props }: ComponentProps<typeof DrawerHandlePrimitive>) {
  return (
    <DrawerHandlePrimitive
      aria-label="Resize"
      className={cnState(
        "mx-auto flex h-5 w-16 shrink-0 cursor-grab items-center justify-center rounded-full outline-none before:h-1.5 before:w-12 before:rounded-full before:bg-muted-foreground focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      {...props}
    />
  )
}

function DrawerHeader({ className, render, ...props }: PartProps<"div">) {
  return renderElement(
    "div",
    { "data-slot": "drawer-header", className: cn("flex flex-col gap-inline", className), ...props },
    render,
  )
}

function DrawerFooter({ className, render, ...props }: PartProps<"div">) {
  return renderElement(
    "div",
    {
      "data-slot": "drawer-footer",
      className: cn("mt-auto flex flex-col-reverse gap-items sm:flex-row sm:justify-end", className),
      ...props,
    },
    render,
  )
}

function DrawerTitle({ className, ...props }: ComponentProps<typeof DrawerTitlePrimitive>) {
  return <DrawerTitlePrimitive className={cnState("text-lg leading-none font-semibold", className)} {...props} />
}

function DrawerDescription({ className, ...props }: ComponentProps<typeof DrawerDescriptionPrimitive>) {
  return <DrawerDescriptionPrimitive className={cnState("text-sm text-muted-foreground", className)} {...props} />
}

function DrawerClose({
  className,
  variant = "outline",
  size,
  ...props
}: ComponentProps<typeof DrawerClosePrimitive> & ButtonLook) {
  return <DrawerClosePrimitive className={cnState(buttonVariants({ variant, size }), className)} {...props} />
}

export {
  Drawer,
  DrawerBackdrop,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHandle,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  createDrawerController,
}
