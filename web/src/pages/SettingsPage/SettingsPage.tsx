import React from 'react';
import { Page } from '../../components/Page';
import { ApiKeysSection } from './ApiKeysSection';

export const SettingsPage: React.FC = () => {
  return (
    <Page showSidebar={true}>
      <div className="max-w-3xl mx-auto space-y-6 pt-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your account settings and API access.</p>
        </div>
        <ApiKeysSection />
      </div>
    </Page>
  );
};
