import React from 'react';
import { BarChart3 } from 'lucide-react';
import { Card, CardContent } from '../../../../components/ui/Card';
import { Spinner } from '../../../../components/ui/Spinner';

export const EmptyState = ({ title, description }: { title: string; description: string }) => (
  <Card>
    <CardContent className="p-10 text-center">
      <BarChart3 className="mx-auto mb-4 h-10 w-10 text-muted-foreground/60" />
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </CardContent>
  </Card>
);

export const LoadingBlock = () => (
  <div className="flex justify-center py-14">
    <Spinner size="lg" variant="muted" />
  </div>
);

export const ErrorBlock = () => (
  <Card className="border-destructive/50">
    <CardContent className="p-6 text-destructive">Failed to load statistics.</CardContent>
  </Card>
);

export const MetricCard = ({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail: string;
}) => (
  <Card>
    <CardContent className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        <div className="rounded-md bg-primary/10 p-2 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </CardContent>
  </Card>
);
