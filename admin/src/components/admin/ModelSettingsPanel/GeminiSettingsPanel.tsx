import type {
  ActiveModelProviderType,
  IGeminiProviderConnection,
  IMiniMaxProviderConnection,
  IOpenRouterProviderConnection,
} from '@shared-types';
import { Badge } from '../../ui/Badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../ui/Card';
import { getProviderDetailFieldValues } from './modelProviderFields';
import { getModelProviderDefinition } from './modelProviderRegistry';

export interface IGeminiSettingsPanelProps {
  geminiConnection: IGeminiProviderConnection;
  openRouterConnection: IOpenRouterProviderConnection;
  miniMaxConnection: IMiniMaxProviderConnection;
  activeProviderId: ActiveModelProviderType;
}

export function GeminiSettingsPanel({
  geminiConnection,
  openRouterConnection,
  miniMaxConnection,
  activeProviderId,
}: IGeminiSettingsPanelProps) {
  const definition = getModelProviderDefinition('gemini');
  const detailFields = getProviderDetailFieldValues('gemini', {
    activeProviderId,
    geminiConnection,
    openRouterConnection,
    miniMaxConnection,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-xl">{definition.label}</CardTitle>
          {definition.staticBadges?.map((badge) => (
            <Badge key={badge} variant="outline">
              {badge}
            </Badge>
          ))}
          {activeProviderId === 'gemini' ? (
            <Badge variant="default">Active</Badge>
          ) : null}
        </div>
        <CardDescription>{definition.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          {detailFields.map((field) => (
            <div key={field.label} className="rounded-lg border border-border p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {field.label}
              </p>
              <p className="mt-2 font-medium">{field.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
