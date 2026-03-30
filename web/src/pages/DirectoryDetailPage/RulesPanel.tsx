import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { Rule } from '@shared-types';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

interface RulesPanelProps {
  rules: Rule[];
  directoryId: string;
}

export const RulesPanel: React.FC<RulesPanelProps> = ({ rules, directoryId }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Sparkles size={20} className="text-primary" />
          Rules
        </h2>
        <Button variant="outline" size="sm" asChild>
          <Link to={`/directories/${directoryId}/rules`}>Manage rules</Link>
        </Button>
      </div>

      {rules.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          No rules attached. Manage rules from the Rules button.
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <Card key={rule.id}>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">{rule.name}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground line-clamp-4">
                {rule.content}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
