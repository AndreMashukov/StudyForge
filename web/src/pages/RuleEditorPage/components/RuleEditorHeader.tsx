import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Spinner } from '../../../components/ui/Spinner';
import { useTheme } from '../../../contexts/ThemeContext';
import { useRuleEditorContext } from '../context/RuleEditorContext';

export const RuleEditorHeader: React.FC = () => {
  const navigate = useNavigate();
  const { currentTheme } = useTheme();
  const { isSaving, save } = useRuleEditorContext();

  const colors = currentTheme.colors;

  return (
    <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4">
      <Button
        variant="ghost"
        onClick={() => navigate('/rules')}
        className="flex items-center gap-2"
      >
        <ArrowLeft size={18} />
        <span>Back to Rules</span>
      </Button>

      <h1 className="text-lg font-semibold text-foreground">
        Create Rule
      </h1>

      <Button
        onClick={save}
        disabled={isSaving}
        style={{
          backgroundColor: colors.primary,
          color: colors.primaryForeground,
        }}
      >
        {isSaving && <Spinner size="xs" className="mr-2" />}
        Create Rule
      </Button>
    </div>
    </div>
  );
};
