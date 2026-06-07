export interface ICreateSubjectWorldFormData {
  documentIds: string[];
  subjectWorldName?: string;
  additionalPrompt?: string;
  ruleIds?: string[];
  followupRuleIds?: string[];
}
