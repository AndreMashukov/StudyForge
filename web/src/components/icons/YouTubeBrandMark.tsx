import React from 'react';
import { cn } from '../../lib/utils';

export interface IYouTubeBrandMarkProps {
  size?: number;
  className?: string;
}

// Brand-asset exception: AGENTS.md says "use Lucide React for icons, no inline <svg>
// when a Lucide icon exists." Lucide ships a generic play-in-rounded-rect <Youtube>
// icon, but not the official YouTube brand mark (red field, white play triangle).
// This component renders the official mark because the user-facing copy refers to
// YouTube specifically and brand recognition is the affordance.
export const YouTubeBrandMark = ({ size = 16, className }: IYouTubeBrandMarkProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    role="img"
    aria-label="YouTube"
    className={cn('inline-block align-middle shrink-0', className)}
  >
    <path
      d="M21.582 6.186a2.506 2.506 0 0 0-1.768-1.768C18.254 4 12 4 12 4s-6.254 0-7.814.418A2.506 2.506 0 0 0 2.418 6.186C2 7.746 2 12 2 12s0 4.254.418 5.814a2.506 2.506 0 0 0 1.768 1.768C5.746 20 12 20 12 20s6.254 0 7.814-.418a2.506 2.506 0 0 0 1.768-1.768C22 16.254 22 12 22 12s0-4.254-.418-5.814z"
      fill="#FF0000"
    />
    <path d="M10 15.463l5.194-3.463L10 8.537v6.926z" fill="#FFFFFF" />
  </svg>
);
