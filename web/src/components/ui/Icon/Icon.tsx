import React from 'react';
import { IIcon } from "./IIcon"
import { iconStyles } from "./Icon.styles"

/**
 * Icon component: SVG icon wrapper.
 */
export const Icon: React.FC<IIcon> = ({ size = 24, className = '', children, style }) => {
	return (
		<svg
			width={size}
			height={size}
			className={`${iconStyles.base} ${className}`}
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
			style={{ width: `${size}px`, height: `${size}px`, ...style }}
		>
			{children}
		</svg>
	);
};