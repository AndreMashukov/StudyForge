import React from 'react';
import { useHomePageContext } from '../context/HomePageContext';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Label } from '../../../components/ui/Label';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Icon } from '../../../components/ui/Icon';
import { ThemeToggle } from '../../../components/ThemeToggle';

export const HomePageContainer = () => {
  const { urlForm, userQuizzes, recentQuizzes, handlers } = useHomePageContext();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlForm.url.trim()) return;
    
    await handlers.handleGenerateQuiz(urlForm.url);
  };

  const handleQuizClick = (quizId: string) => {
    handlers.handleNavigateToQuiz(quizId);
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-16 space-y-12">
      {/* Theme Toggle */}
      <div className="flex justify-end">
        <ThemeToggle />
      </div>

      {/* Header Section */}
      <div className="text-center space-y-6">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-foreground tracking-tight">
            AI Quiz Generator
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Transform any article or blog post into an interactive quiz using AI.
            Perfect for learning, teaching, and knowledge retention.
          </p>
        </div>

        {/* URL Input Form */}
        <Card className="max-w-2xl mx-auto linear-glass border border-border/30">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold text-foreground">
              Generate Quiz from URL
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="url" className="text-sm font-medium text-foreground">
                  Article URL
                </Label>
                <Input
                  id="url"
                  type="url"
                  value={urlForm.url}
                  onChange={(e) => urlForm.setUrl(e.target.value)}
                  placeholder="https://example.com/article"
                  className="bg-input border-border/50 focus:border-primary/50 linear-transition"
                  disabled={urlForm.isGenerating}
                  required
                />
                {urlForm.error && (
                  <p className="text-destructive text-sm mt-2">{urlForm.error}</p>
                )}
              </div>
              
              <Button
                type="submit"
                disabled={urlForm.isGenerating || !urlForm.url.trim()}
                className="w-full linear-button linear-glow-hover"
              >
                {urlForm.isGenerating ? (
                  <div className="flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></div>
                    Generating Quiz...
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <Icon size={16} className="mr-2">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </Icon>
                    Generate Quiz
                  </div>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Dashboard Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Your Quizzes */}
        <Card className="linear-glass border border-border/30">
          <CardHeader>
            <CardTitle className="flex items-center text-foreground">
              <Icon size={20} className="mr-2">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </Icon>
              Your Quizzes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {userQuizzes.isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
                ))}
              </div>
            ) : userQuizzes.data && userQuizzes.data.length > 0 ? (
              <div className="space-y-3">
                {userQuizzes.data.slice(0, 5).map((quiz) => (
                  <div
                    key={quiz.id}
                    onClick={() => handleQuizClick(quiz.id)}
                    className="flex items-center justify-between p-4 bg-card/50 rounded-lg border border-border/30 hover:border-primary/30 cursor-pointer linear-transition group"
                  >
                    <div className="flex-1">
                      <h3 className="font-medium text-foreground group-hover:text-primary linear-transition">
                        {quiz.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {quiz.questions.length} questions
                      </p>
                    </div>
                    <Icon size={16} className="text-muted-foreground group-hover:text-primary linear-transition">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </Icon>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Icon size={48} className="mx-auto text-muted-foreground/50 mb-4">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </Icon>
                <p className="text-muted-foreground">
                  No quizzes yet. Generate your first quiz!
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Public Quizzes */}
        <Card className="linear-glass border border-border/30">
          <CardHeader>
            <CardTitle className="flex items-center text-foreground">
              <Icon size={20} className="mr-2">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </Icon>
              Recent Quizzes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentQuizzes.isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
                ))}
              </div>
            ) : recentQuizzes.data && recentQuizzes.data.length > 0 ? (
              <div className="space-y-3">
                {recentQuizzes.data.slice(0, 5).map((quiz) => (
                  <div
                    key={quiz.id}
                    onClick={() => handleQuizClick(quiz.id)}
                    className="flex items-center justify-between p-4 bg-card/50 rounded-lg border border-border/30 hover:border-primary/30 cursor-pointer linear-transition group"
                  >
                    <div className="flex-1">
                      <h3 className="font-medium text-foreground group-hover:text-primary linear-transition">
                        {quiz.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {quiz.questions.length} questions
                      </p>
                    </div>
                    <Icon size={16} className="text-muted-foreground group-hover:text-primary linear-transition">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </Icon>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Icon size={48} className="mx-auto text-muted-foreground/50 mb-4">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </Icon>
                <p className="text-muted-foreground">
                  No recent quizzes available.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};