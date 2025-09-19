import * as React from "react"

/** Props for the Icon component */
export interface IIcon {
  /** Icon size in pixels */
  size?: number
  /** Additional CSS classes */
  className?: string
  /** Child SVG elements */
  children: React.ReactNode
  /** Inline style object */
  style?: React.CSSProperties
}