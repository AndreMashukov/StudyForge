import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Spinner } from '../../../components/ui/Spinner';
import { useTheme } from '../../../contexts/ThemeContext';
import { useRuleEditorContext } from '../context/RuleEditorContext';
import { resolveRuleEditorReturnPath } from '../utils/ruleEditorReturnPath';

export const RuleEditorHeader: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnPath = resolveRuleEditorReturnPath(searchParams.get('directoryId'));
  const { currentTheme } = useTheme();
  const { mode, isSaving, save, deleteRule } = useRuleEditorContext();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const colors = currentTheme.colors;

  const handleDelete = async () => {
    await deleteRule();
    setShowDeleteConfirm(false);
  };

  return (
    <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4">
      <Button
        variant="ghost"
        onClick={() => navigate(returnPath)}
        className="flex items-center gap-2"
      >
        <ArrowLeft size={18} />
        <span>Back to Prompts</span>
      </Button>

      <h1 className="text-lg font-semibold text-foreground">
        {mode === 'create' ? 'Create Prompt' : 'Edit Prompt'}
      </h1>

      <div className="flex items-center gap-3">
        {mode === 'edit' && (
          showDeleteConfirm ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleDelete}
                style={{
                  backgroundColor: colors.destructive,
                  color: colors.destructiveForeground,
                }}
              >
                Confirm Delete
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(true)}
              style={{
                borderColor: colors.destructive,
                color: colors.destructive,
              }}
            >
              <Trash2 size={16} className="mr-1" />
              Delete
            </Button>
          )
        )}

        <Button
          onClick={save}
          disabled={isSaving}
          style={{
            backgroundColor: colors.primary,
            color: colors.primaryForeground,
          }}
        >
          {isSaving && <Spinner size="xs" className="mr-2" />}
          {mode === 'create' ? 'Create Prompt' : 'Save Changes'}
        </Button>
      </div>
    </div>
    </div>
  );
};
