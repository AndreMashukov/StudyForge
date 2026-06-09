export interface IGenerationInfoTooltip {
  createdAt: Date | { toDate(): Date } | { _seconds: number; _nanoseconds: number } | string | number | null | undefined;
  completedAt?: Date | { toDate(): Date } | { _seconds: number; _nanoseconds: number } | string | number | null | undefined;
  ruleNames: string[];
  generationModel?: string;
}
