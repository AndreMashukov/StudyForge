import React from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';

export const QuizPage: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();

  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <Card className="linear-glass border border-border/30">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground">
            Quiz Page
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Quiz ID: {quizId}
          </p>
          <p className="text-muted-foreground mt-2">
            Quiz functionality will be implemented in the next phase.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};