import { cva } from "class-variance-authority"

/**
 * Variants for the Label component.
 */
export const labelVariants = cva(
  "block text-sm font-medium leading-none mb-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
)