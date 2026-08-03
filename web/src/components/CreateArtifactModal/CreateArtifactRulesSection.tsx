import React from 'react';
import { RuleApplicability } from '@shared-types';
import { CompactRuleSelector } from '../CompactRuleSelector';

export interface ICreateArtifactRulesSection {
  directoryId: string;
  ruleApplicability: RuleApplicability;
  followupRuleApplicability?: RuleApplicability;
  descriptionRuleApplicability?: RuleApplicability;
  ruleIds: string[];
  followupRuleIds: string[];
  descriptionRuleIds: string[];
  onRuleIdsChange: (ruleIds: string[]) => void;
  onFollowupRuleIdsChange: (ruleIds: string[]) => void;
  onDescriptionRuleIdsChange: (ruleIds: string[]) => void;
}

export const CreateArtifactRulesSection: React.FC<ICreateArtifactRulesSection> = ({
  directoryId,
  ruleApplicability,
  followupRuleApplicability,
  descriptionRuleApplicability,
  ruleIds,
  followupRuleIds,
  descriptionRuleIds,
  onRuleIdsChange,
  onFollowupRuleIdsChange,
  onDescriptionRuleIdsChange,
}) => {
  return (
    <div className="space-y-4">
      <CompactRuleSelector
        directoryId={directoryId}
        operation={ruleApplicability}
        selectedRuleIds={ruleIds}
        onSelectionChange={onRuleIdsChange}
        label="Generation rules"
      />

      {followupRuleApplicability ? (
        <CompactRuleSelector
          directoryId={directoryId}
          operation={followupRuleApplicability}
          selectedRuleIds={followupRuleIds}
          onSelectionChange={onFollowupRuleIdsChange}
          label="Detailed explanation rules"
        />
      ) : null}

      {descriptionRuleApplicability ? (
        <CompactRuleSelector
          directoryId={directoryId}
          operation={descriptionRuleApplicability}
          selectedRuleIds={descriptionRuleIds}
          onSelectionChange={onDescriptionRuleIdsChange}
          label="Description rules"
        />
      ) : null}
    </div>
  );
};
