import React from 'react';
import { AuthForm } from '../../components/AuthForm';
import { Icon } from '../../components/ui/Icon';

export const AuthPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      {/* Hero Section */}
      <div className="w-full max-w-4xl text-center mb-12">
        <div className="space-y-8">
          {/* Logo/Brand */}
          <div className="flex items-center justify-center space-x-3">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
              <Icon size={24} className="text-primary-foreground">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </Icon>
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              Quiz AI Generator
            </h1>
          </div>

          {/* Value Proposition */}
          <div className="space-y-6">
            <h2 className="text-4xl font-bold text-foreground tracking-tight">
              Transform Articles into Interactive Quizzes
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Turn any article, blog post, or web content into engaging multiple-choice quizzes
              using advanced AI. Perfect for educators, students, and lifelong learners.
            </p>
          </div>

          {/* Feature Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto border border-primary/20">
                <Icon size={20} className="text-primary">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </Icon>
              </div>
              <h3 className="text-sm font-semibold text-foreground">AI-Powered Generation</h3>
              <p className="text-xs text-muted-foreground">
                Advanced AI extracts key concepts and creates relevant questions automatically
              </p>
            </div>
            
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mx-auto border border-accent/20">
                <Icon size={20} className="text-accent">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </Icon>
              </div>
              <h3 className="text-sm font-semibold text-foreground">Multiple Content Types</h3>
              <p className="text-xs text-muted-foreground">
                Works with articles, blog posts, documentation, and educational content
              </p>
            </div>
            
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-destructive/10 rounded-lg flex items-center justify-center mx-auto border border-destructive/20">
                <Icon size={20} className="text-destructive">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </Icon>
              </div>
              <h3 className="text-sm font-semibold text-foreground">Instant Results</h3>
              <p className="text-xs text-muted-foreground">
                Generate comprehensive quizzes in seconds, ready for immediate use
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Auth Form Section */}
      <div className="w-full max-w-md">
        <AuthForm />
      </div>

      {/* Footer */}
      <div className="mt-12 text-center">
        <p className="text-sm text-muted-foreground">
          Join thousands of educators and learners transforming content into knowledge.
        </p>
      </div>
    </div>
  );
};