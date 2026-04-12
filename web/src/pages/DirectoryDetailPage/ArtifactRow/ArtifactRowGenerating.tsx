import React from 'react';
import { Spinner } from '../../../components/ui/Spinner';

interface ArtifactRowGeneratingProps {
  label: string;
}

export const ArtifactRowGenerating: React.FC<ArtifactRowGeneratingProps> = ({ label }) => {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <Spinner size="xs" />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-primary">{label}</div>
      </div>
    </div>
  );
};
