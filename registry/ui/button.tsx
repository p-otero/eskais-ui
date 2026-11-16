"use client"

import { Button as ButtonPrimitive, type ButtonState } from "@ui-sdk/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { Children, isValidElement, type ComponentProps, type ReactNode } from "react"

import { Spinner } from "@/components/ui/spinner"
import { cnState } from "@/lib/utils"

const buttonVariants = cva(
  "touch-target inline-flex shrink-0 cursor-pointer items-center justify-center gap-inline rounded-control text-sm font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-disabled:not-data-pending:cursor-not-allowed data-disabled:not-data-pending:opacity-50 active:not-data-disabled:translate-y-px data-pending:relative data-pending:cursor-progress data-pending:[&>[data-slot=spinner]+*]:hidden data-pending:has-[>[data-slot=spinner][data-overlay]]:text-transparent! [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        outline: "border border-input bg-background/(--glass-opacity) hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        link: "text-link underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-control-sm px-control-x",
        default: "h-control px-control-x",
        lg: "h-control-lg px-control-x text-base",
        icon: "size-control",
      },
      wrap: {
        true: "h-auto shrink whitespace-normal py-inset-chip text-center",
        false: "",
      },
    },
    compoundVariants: [
      { wrap: true, size: "sm", class: "min-h-control-sm" },
      { wrap: true, size: "default", class: "min-h-control" },
      { wrap: true, size: "lg", class: "min-h-control-lg" },
    ],
    defaultVariants: { variant: "default", size: "default", wrap: false },
  },
)

type ButtonVariants = VariantProps<typeof buttonVariants>

type ButtonBaseProps = Omit<ComponentProps<typeof ButtonPrimitive>, "aria-label"> & {
  variant?: ButtonVariants["variant"]
  /** Shows a spinner, sets `aria-busy` and ignores presses while keeping focus, for work this button didn't start. */
  loading?: boolean
  /** Lets a text button shrink and wrap its label onto more lines in a tight row, instead of overflowing it. */
  wrap?: boolean
}

type ButtonProps =
  | (ButtonBaseProps & { size?: Exclude<ButtonVariants["size"], "icon">; "aria-label"?: string })
  | (ButtonBaseProps & { size: "icon"; "aria-label": string })

const overlaySpinnerVariants = cva("absolute inset-0 m-auto", {
  variants: {
    variant: {
      default: "text-primary-foreground",
      secondary: "text-secondary-foreground",
      outline: "text-foreground",
      ghost: "text-foreground",
      destructive: "text-destructive-foreground",
      link: "text-link",
    },
  },
  defaultVariants: { variant: "default" },
})

// A leading icon is swapped for the spinner, so the width holds. Text alone stays in place with transparent colour
// under a centered spinner. It stays a direct child: Chrome drops text inside a wrapper from a busy button's name.
function withSpinner(children: ReactNode, iconOnly: boolean, variant: ButtonVariants["variant"]) {
  const items = Children.toArray(children)
  const leadingIcon = isValidElement(items[0]) && (items.length > 1 || iconOnly)
  return (
    <>
      {leadingIcon ? (
        <Spinner data-show="pending" />
      ) : (
        <Spinner data-show="pending" data-overlay="" className={overlaySpinnerVariants({ variant })} />
      )}
      {children}
    </>
  )
}

function Button({
  className,
  variant,
  size,
  loading,
  wrap,
  disabled,
  focusableWhenDisabled,
  children,
  ...props
}: ButtonProps) {
  const iconOnly = size === "icon"
  return (
    <ButtonPrimitive
      data-variant={variant ?? "default"}
      data-size={size ?? "default"}
      {...(loading ? { "data-pending": "", "aria-busy": true } : {})}
      disabled={disabled || loading}
      focusableWhenDisabled={focusableWhenDisabled || loading}
      className={cnState(buttonVariants({ variant, size, wrap: wrap && !iconOnly }), className)}
      {...props}
    >
      {typeof children === "function"
        ? (state: ButtonState) => withSpinner(children(state), iconOnly, variant)
        : withSpinner(children, iconOnly, variant)}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
export type { ButtonProps }
