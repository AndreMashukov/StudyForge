import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { useDeleteDirectoryMutation } from '../../store/api/Directory/DirectoryApi';
import { useDeleteDocumentMutation } from '../../store/api/Documents/documentsApi';
import { useDeleteQuizMutation } from '../../store/api/Quiz/QuizApi';
import { useDeleteRuleMutation } from '../../store/api/Rules/rulesApi';
import { IAgentDeleteProposalCard } from './IAgentPanel';

export const AgentDeleteProposalCard: React.FC<IAgentDeleteProposalCard> = ({
  proposal,
  onConfirmed,
}) => {
  const [deleteDirectory] = useDeleteDirectoryMutation();
  const [deleteDocument] = useDeleteDocumentMutation();
  const [deleteQuiz] = useDeleteQuizMutation();
  const [deleteRule] = useDeleteRuleMutation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);

    try {
      if (proposal.targetType === 'directory') {
        await deleteDirectory(proposal.targetId).unwrap();
      } else if (proposal.targetType === 'document') {
        await deleteDocument({ documentId: proposal.targetId }).unwrap();
      } else if (proposal.targetType === 'quiz') {
        await deleteQuiz({ quizId: proposal.targetId }).unwrap();
      } else if (proposal.targetType === 'rule') {
        await deleteRule({ ruleId: proposal.targetId }).unwrap();
      } else {
        const unsupported: never = proposal.targetType;
        throw new Error(`Unsupported delete target: ${String(unsupported)}`);
      }
      onConfirmed();
    } catch (confirmError) {
      setError(
        confirmError instanceof Error ? confirmError.message : 'Delete failed',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
      <div className="mb-2 flex items-center gap-2 font-medium text-destructive">
        <Trash2 size={14} aria-hidden="true" />
        <span>
          Delete {proposal.targetType}: {proposal.label}
        </span>
      </div>
      {proposal.reason ? (
        <p className="mb-2 text-muted-foreground">{proposal.reason}</p>
      ) : null}
      {error ? <p className="mb-2 text-destructive">{error}</p> : null}
      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={loading}
        onClick={() => void handleConfirm()}
      >
        {loading ? 'Deleting...' : 'Confirm delete'}
      </Button>
    </div>
  );
};
