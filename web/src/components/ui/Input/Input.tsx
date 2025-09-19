import * as React from "react"
import { cn } from "../../../lib/utils"
import { IInput } from "./IInput"
import { inputStyles } from "./Input.styles"

/**
 * Input component: text input field.
 */
const Input = React.forwardRef<HTMLInputElement, IInput>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(inputStyles.base, className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }