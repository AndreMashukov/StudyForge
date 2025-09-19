import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { VariantProps } from "class-variance-authority"
import { labelVariants } from "./Label.styles"

/** Props for the Label component */
export interface ILabel
  extends React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>,
    VariantProps<typeof labelVariants> {}