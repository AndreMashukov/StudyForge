import * as React from "react"
import { Slot } from "@radix-ui/react-slot"

import { cn } from "../../../lib/utils"
import { useTheme } from "../../../contexts/ThemeContext"
import { IButton } from "./IButton"
import { buttonVariants, getVariantStyles } from "./Button.styles"

const Button = React.forwardRef<HTMLButtonElement, IButton>(
	({ className, variant, size, asChild = false, style, ...props }, ref) => {
		const { currentTheme } = useTheme();
		const Comp = asChild ? Slot : "button";

		const variantStyles = getVariantStyles(variant, currentTheme);
		const combinedStyles = { ...variantStyles, ...style };

		return (
			<Comp
				className={cn(buttonVariants({ variant, size, className }))}
				style={combinedStyles}
				ref={ref}
				{...props}
			/>
		);
	}
);
Button.displayName = "Button"

export { Button, buttonVariants }