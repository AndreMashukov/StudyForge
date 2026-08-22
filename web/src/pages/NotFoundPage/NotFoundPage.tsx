import React from 'react';
import { Link } from 'react-router-dom';
import { Page } from '../../components/Page';
import { MascotImage } from '../../components/MascotImage';
import { Button } from '../../components/ui/Button';

export const NotFoundPage: React.FC = () => {
  return (
    <Page showSidebar={true}>
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <MascotImage variant="curious" alt="" className="mb-6 h-24 w-24" />
        <h1 className="font-heading text-2xl font-semibold">Page not found</h1>
        <p className="mt-2 max-w-md text-muted-foreground">
          This address is not a StudyForge page. Open your workspace to continue.
        </p>
        <Button asChild className="mt-6">
          <Link to="/">Go to workspace</Link>
        </Button>
      </div>
    </Page>
  );
};
