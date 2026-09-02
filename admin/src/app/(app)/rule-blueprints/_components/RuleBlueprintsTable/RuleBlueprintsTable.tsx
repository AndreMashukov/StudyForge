'use client';

import Link from 'next/link';
import type { IRuleBlueprint } from '@shared-types';
import { Badge } from '@admin/components/ui/Badge';

export interface IRuleBlueprintsTableProps {
  blueprints: IRuleBlueprint[];
}

function statusVariant(
  status: IRuleBlueprint['status'],
): 'default' | 'secondary' | 'outline' {
  if (status === 'published') {
    return 'default';
  }
  if (status === 'archived') {
    return 'outline';
  }
  return 'secondary';
}

export function RuleBlueprintsTable({ blueprints }: IRuleBlueprintsTableProps) {
  if (blueprints.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No rule blueprints yet. Create one to give the workspace agent canonical rule templates.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="min-w-full divide-y divide-border text-sm">
        <thead className="bg-muted/40 text-left text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Applicability</th>
            <th className="px-4 py-3 font-medium">Version</th>
            <th className="px-4 py-3 font-medium">Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-card">
          {blueprints.map((blueprint) => (
            <tr key={blueprint.id} className="hover:bg-muted/20">
              <td className="px-4 py-3">
                <Link
                  href={`/rule-blueprints/${blueprint.id}`}
                  className="font-medium text-foreground hover:text-primary"
                >
                  {blueprint.name}
                </Link>
                {blueprint.description ? (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                    {blueprint.description}
                  </p>
                ) : null}
              </td>
              <td className="px-4 py-3">
                <Badge variant={statusVariant(blueprint.status)}>
                  {blueprint.status}
                </Badge>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {blueprint.applicableTo.join(', ')}
              </td>
              <td className="px-4 py-3 text-muted-foreground">v{blueprint.version}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {new Date(blueprint.updatedAt).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
