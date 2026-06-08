import React from 'react';
import { SubjectWorldZone } from '@shared-types';

interface ISubjectWorldZoneBannerProps {
  zone: SubjectWorldZone | null;
}

export const SubjectWorldZoneBanner: React.FC<ISubjectWorldZoneBannerProps> = ({ zone }) => {
  if (!zone) return null;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-24 z-20 flex justify-center px-4 transition-opacity duration-300"
      role="status"
      aria-live="polite"
    >
      <div className="max-w-lg rounded-lg border border-primary/40 bg-background/90 px-5 py-3 text-center shadow-lg backdrop-blur">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">Entering zone</p>
        <h2 className="mt-1 text-lg font-semibold">{zone.name}</h2>
        {zone.sectionHeading && zone.sectionHeading !== zone.name && (
          <p className="mt-1 text-sm text-muted-foreground">{zone.sectionHeading}</p>
        )}
        {zone.description && (
          <p className="mt-1 text-xs text-muted-foreground">{zone.description}</p>
        )}
      </div>
    </div>
  );
};
