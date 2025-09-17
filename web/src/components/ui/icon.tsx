import React from 'react';

interface IconProps {
  size?: number;
  className?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export const Icon: React.FC<IconProps> = ({ size = 24, className = '', children, style }) => {
  return (
    <svg
      width={size}
      height={size}
      className={`inline-block ${className}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      style={{ width: `${size}px`, height: `${size}px`, ...style }}
    >
      {children}
    </svg>
  );
};