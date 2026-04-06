import React from 'react';

interface ArtifactRowGeneratingProps {
  label: string;
}

export const ArtifactRowGenerating: React.FC<ArtifactRowGeneratingProps> = ({ label }) => {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-primary border-t-transparent shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-primary">{label}</div>
      </div>
    </div>
  );
};
