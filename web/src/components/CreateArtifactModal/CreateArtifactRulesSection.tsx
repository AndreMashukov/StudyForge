import React from 'react';
import { RuleApplicability } from '@shared-types';
import { CompactRuleSelector } from '../CompactRuleSelector';

export interface ICreateArtifactRulesSection {
  directoryId: string;
  ruleApplicability: RuleApplicability;
  descriptionRuleApplicability?: RuleApplicability;
  ruleIds: string[];
  descriptionRuleIds: string[];
  onRuleIdsChange: (ruleIds: string[]) => void;
  onDescriptionRuleIdsChange: (ruleIds: string[]) => void;
}

export const CreateArtifactRulesSection: React.FC<ICreateArtifactRulesSection> = ({
  directoryId,
  ruleApplicability,
  descriptionRuleApplicability,
  ruleIds,
  descriptionRuleIds,
  onRuleIdsChange,
  onDescriptionRuleIdsChange,
}) => (
  <div className="space-y-4">
    <CompactRuleSelector
      directoryId={directoryId}
      operation={ruleApplicability}
      selectedRuleIds={ruleIds}
      onSelectionChange={onRuleIdsChange}
      label="Generation prompts"
    />

    {descriptionRuleApplicability ? (
      <CompactRuleSelector
        directoryId={directoryId}
        operation={descriptionRuleApplicability}
        selectedRuleIds={descriptionRuleIds}
        onSelectionChange={onDescriptionRuleIdsChange}
        label="Description prompts"
      />
    ) : null}
  </div>
);
