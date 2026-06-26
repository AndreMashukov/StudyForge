import Link from 'next/link';
import { Badge } from '../../ui/Badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../ui/Card';
import type {
  IGeminiProviderConnection,
  IMiniMaxProviderConnection,
  IOpenRouterProviderConnection,
} from '@shared-types';

export interface IProviderConnectionsOverviewProps {
  geminiConnection: IGeminiProviderConnection;
  openRouterConnection: IOpenRouterProviderConnection;
  miniMaxConnection: IMiniMaxProviderConnection;
  encryptionConfigured: boolean;
}

export function ProviderConnectionsOverview({
  geminiConnection,
  openRouterConnection,
  miniMaxConnection,
  encryptionConfigured,
}: IProviderConnectionsOverviewProps) {
  const providers = [
    {
      href: '/provider-connections/gemini',
      label: 'Gemini',
      description: 'Encrypted API key stored in Firestore.',
      status: geminiConnection.apiKeyConfigured ? 'Configured' : 'Missing credentials',
      editable: true,
    },
    {
      href: '/provider-connections/openrouter',
      label: 'OpenRouter',
      description: 'Encrypted API key stored in Firestore.',
      status: openRouterConnection.apiKeyConfigured ? 'Configured' : 'Missing credentials',
      editable: true,
    },
    {
      href: '/provider-connections/minimax',
      label: 'MiniMax',
      description: 'Encrypted API key stored in Firestore.',
      status: miniMaxConnection.apiKeyConfigured ? 'Configured' : 'Missing credentials',
      editable: true,
    },
  ];

  return (
    <div className="space-y-4">
      {!encryptionConfigured ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          LLM_SETTINGS_ENCRYPTION_KEY is not configured. Provider credentials cannot be saved.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        {providers.map((provider) => (
          <Card key={provider.href}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">{provider.label}</CardTitle>
                <Badge variant={provider.status === 'Configured' ? 'default' : 'secondary'}>
                  {provider.status}
                </Badge>
              </div>
              <CardDescription>{provider.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={provider.href} className="text-sm text-primary hover:underline">
                {provider.editable ? 'Configure connection' : 'View details'}
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        Gemini default model: {geminiConnection.defaultModel}
      </p>
    </div>
  );
}
