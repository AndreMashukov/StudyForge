import * as React from "react";
import { VariantProps } from "class-variance-authority";
import { buttonVariants } from "./Button.styles";

export interface IButton
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {
	asChild?: boolean;
}