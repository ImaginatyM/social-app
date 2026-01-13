import * as React from "react"

function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ")
}

type BadgeVariant = "default" | "secondary" | "destructive" | "outline"

const variantMap: Record<BadgeVariant, string> = {
  default: "border-transparent bg-primary text-primary-foreground",
  secondary: "border-transparent bg-secondary text-secondary-foreground",
  destructive: "border-transparent bg-destructive text-destructive-foreground",
  outline: "text-foreground",
}

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({className, variant = "default", ...props}, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          variantMap[variant],
          className,
        )}
        {...props}
      />
    )
  },
)
Badge.displayName = "Badge"

export {Badge}
export default Badge
