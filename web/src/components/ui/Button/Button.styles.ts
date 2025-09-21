import * as React from "react";
import { cva } from "class-variance-authority";
import { Theme } from "../../../types/theme";

export const buttonVariants = cva(
	"inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
	{
		variants: {
			variant: {
				default: "text-white hover:opacity-90",
				destructive: "text-white hover:opacity-90",
				outline: "border hover:opacity-90",
				secondary: "hover:opacity-80",
				ghost: "hover:opacity-90",
				link: "underline-offset-4 hover:underline",
			},
			size: {
				default: "h-10 px-4 py-2",
				sm: "h-9 rounded-md px-3",
				lg: "h-11 rounded-md px-8",
				icon: "h-10 w-10",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	}
);

// Define theme-aware styles based on variant
export const getVariantStyles = (variant: string | null | undefined, currentTheme: Theme): React.CSSProperties => {
	const colors = currentTheme.colors;
	
	switch (variant) {
		case 'default':
			return {
				backgroundColor: colors.primary,
				color: colors.primaryForeground,
				borderRadius: colors.radius,
			};
		case 'destructive':
			return {
				backgroundColor: colors.destructive,
				color: colors.destructiveForeground,
				borderRadius: colors.radius,
			};
		case 'outline':
			return {
				backgroundColor: colors.background,
				color: colors.foreground,
				borderColor: colors.border,
				borderWidth: '1px',
				borderRadius: colors.radius,
			};
		case 'secondary':
			return {
				backgroundColor: colors.secondary,
				color: colors.secondaryForeground,
				borderRadius: colors.radius,
			};
		case 'ghost':
			return {
				backgroundColor: 'transparent',
				color: colors.foreground,
				borderRadius: colors.radius,
			};
		case 'link':
			return {
				backgroundColor: 'transparent',
				color: colors.primary,
				borderRadius: colors.radius,
			};
		default:
			return {
				backgroundColor: colors.primary,
				color: colors.primaryForeground,
				borderRadius: colors.radius,
			};
	}
};