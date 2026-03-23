import React, { useState } from 'react';
import { useGetApplicableRulesQuery } from '../../store/api/Rules/rulesApi';
import { Card, CardContent } from '../ui/Card';
import { Sparkles, ChevronDown, ChevronRight } from 'lucide-react';
import { IResolvedRulesInfo } from './IResolvedRulesInfo';

export const ResolvedRulesInfo = ({ directoryId, operation }: IResolvedRulesInfo) => {
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading } = useGetApplicableRulesQuery(
    { directoryId: directoryId ?? '', operation },
    { skip: !directoryId }
  );

  if (!directoryId) return null;

  const rules = data?.rules ?? [];
  const ruleCount = rules.length;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Sparkles size={16} className="animate-pulse" />
        Loading rules...
      </div>
    );
  }

  if (ruleCount === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Sparkles size={16} />
        No rules will be applied from this directory.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors w-full text-left"
      >
        <Sparkles size={16} className="text-primary shrink-0" />
        {ruleCount} rule{ruleCount !== 1 ? 's' : ''} will be auto-applied
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {expanded && (
        <div className="space-y-2 pl-6">
          {rules.map((rule) => (
            <Card key={rule.id} className="bg-muted/30">
              <CardContent className="py-2 px-3">
                <p className="text-sm font-medium">{rule.name}</p>
                {rule.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {rule.description}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
