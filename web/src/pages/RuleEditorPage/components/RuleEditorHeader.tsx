import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Spinner } from '../../../components/ui/Spinner';
import { useTheme } from '../../../contexts/ThemeContext';
import { useRuleEditorContext } from '../context/RuleEditorContext';

export const RuleEditorHeader: React.FC = () => {
  const navigate = useNavigate();
  const { currentTheme } = useTheme();
  const { mode, isSaving, save, deleteRule } = useRuleEditorContext();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const colors = currentTheme.colors;

  const handleDelete = async () => {
    await deleteRule();
    setShowDeleteConfirm(false);
  };

  return (
    <div
      className="flex items-center justify-between px-6 py-4 border-b"
      style={{
        backgroundColor: colors.card,
        borderColor: colors.border,
      }}
    >
      {/* Left: Back button */}
      <Button
        variant="ghost"
        onClick={() => navigate('/rules')}
        className="flex items-center gap-2"
      >
        <ArrowLeft size={18} />
        <span>Back to Rules</span>
      </Button>

      {/* Center: Title */}
      <h1
        className="text-lg font-semibold"
        style={{ color: colors.foreground }}
      >
        {mode === 'create' ? 'Create Rule' : 'Edit Rule'}
      </h1>

      {/* Right: Actions */}
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
          {mode === 'create' ? 'Create Rule' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
};
