import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { Textarea } from '../../../../components/ui/Textarea';
import { Button } from '../../../../components/ui/Button';
import { Card, CardContent } from '../../../../components/ui/Card';
import { MarkdownRenderer } from '../../../../components/MarkdownRenderer';
import { IDocumentQuestionForm } from './IDocumentQuestionForm';
import { documentQuestionFormStyles as styles } from './DocumentQuestionForm.styles';
import { Spinner } from '../../../../components/ui/Spinner';

export const DocumentQuestionForm: React.FC<IDocumentQuestionForm> = ({
  onSubmit,
  isLoading,
  answer,
  error,
}) => {
  const [question, setQuestion] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || isLoading) return;
    onSubmit(trimmed);
  };

  return (
    <div className={styles.container}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <Textarea
          placeholder="Ask a question about this document..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={isLoading}
          rows={3}
          maxLength={2000}
          showCharCount
        />
        <div className={styles.buttonRow}>
          <Button
            type="submit"
            disabled={!question.trim() || isLoading}
            size="lg"
          >
            {isLoading ? (
              <>
                <Spinner size="xs" variant="on-primary" className="mr-2" />
                Generating Answer...
              </>
            ) : (
              <>
                <Send size={16} className="mr-2" />
                Ask Question
              </>
            )}
          </Button>
        </div>
      </form>

      {error && (
        <div className={styles.errorContainer}>
          <p className={styles.errorText}>{error}</p>
        </div>
      )}

      {answer && (
        <Card className={styles.answerCard}>
          <CardContent className={styles.answerContent}>
            <h3 className={styles.answerHeading}>
              Answer
            </h3>
            <div className={styles.answerBody}>
              <MarkdownRenderer content={answer} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
