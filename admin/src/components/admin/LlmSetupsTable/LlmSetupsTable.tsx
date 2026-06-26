import Link from 'next/link';
import type { IAdminLlmSetupSummary } from '../../../lib/data/llm-setups';
import { Badge } from '../../ui/Badge';

export interface ILlmSetupsTableProps {
  setups: IAdminLlmSetupSummary[];
}

export function LlmSetupsTable({ setups }: ILlmSetupsTableProps) {
  if (setups.length === 0) {
    return <p className="text-sm text-muted-foreground">No LLM setups yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border bg-muted/50">
          <tr>
            <th className="px-4 py-3 font-medium" scope="col">Name</th>
            <th className="px-4 py-3 font-medium" scope="col">Text</th>
            <th className="px-4 py-3 font-medium" scope="col">Vision</th>
            <th className="px-4 py-3 font-medium" scope="col">Image</th>
            <th className="px-4 py-3 font-medium" scope="col">Groups</th>
            <th className="px-4 py-3 font-medium" scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {setups.map((setup) => (
            <tr key={setup.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3">
                <Link href={`/llm-setups/${setup.id}`} className="font-medium text-primary hover:underline">
                  {setup.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {setup.routes.text.providerType} / {setup.routes.text.model}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {setup.routes.vision.providerType} / {setup.routes.vision.model}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {setup.routes.image.providerType} / {setup.routes.image.model}
              </td>
              <td className="px-4 py-3">{setup.referencedGroupCount}</td>
              <td className="px-4 py-3">
                {setup.providerWarnings.length > 0 ? (
                  <Badge variant="secondary">Provider warning</Badge>
                ) : (
                  <Badge variant="default">Ready</Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
