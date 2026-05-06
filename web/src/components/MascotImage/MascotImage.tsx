import React from 'react';
import { cn } from '../../lib/utils';
import { IMascotImage } from './IMascotImage';

const mascotSources: Record<IMascotImage['variant'], string> = {
  curious: '/mascot/forge-fox-curious-nobg.png',
  happy: '/mascot/forge-fox-happy-nobg.png',
  neutral: '/mascot/forge-fox-neutral-nobg.png',
  thinking: '/mascot/forge-fox-thinking-nobg.png',
};

export const MascotImage = ({ variant, alt, className }: IMascotImage): React.JSX.Element => {
  return (
    <img
      src={mascotSources[variant]}
      alt={alt}
      className={cn('pointer-events-none select-none object-contain', className)}
      loading="lazy"
      draggable={false}
    />
  );
};