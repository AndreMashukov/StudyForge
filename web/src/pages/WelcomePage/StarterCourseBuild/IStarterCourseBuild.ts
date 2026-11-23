export interface IStarterCourseBuild {
  threadId: string;
  subject?: string;
  /** Library path of the course folder, once it exists. */
  coursePath: string | null;
  /** Library path of the instant sample folder. */
  samplePath: string | null;
  onAgentMutated: () => void;
}
