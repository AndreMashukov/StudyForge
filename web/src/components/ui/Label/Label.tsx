import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cn } from "../../../lib/utils"
import { ILabel } from "./ILabel"
import { labelVariants } from "./Label.styles"

/**
 * Label component: accessible label for form elements.
 */
const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  ILabel
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(labelVariants(), className)}
    {...props}
  />
))
Label.displayName = LabelPrimitive.Root.displayName

export { Label }