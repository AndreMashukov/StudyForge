import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Plus, FileText, Brain, BarChart3, Globe, Upload } from 'lucide-react';

export const HomePageContainer = () => {
  const navigate = useNavigate();

  const quickActions = [
    {
      title: 'Create Document',
      description: 'Add content from URL or upload markdown file',
      icon: Plus,
      color: 'bg-primary text-primary-foreground',
      action: () => navigate('/documents/create'),
    },
    {
      title: 'Browse Documents',
      description: 'View and manage your document library',
      icon: FileText,
      color: 'bg-secondary text-secondary-foreground',
      action: () => navigate('/documents'),
    },
    {
      title: 'My Quizzes',
      description: 'Access your generated quizzes',
      icon: Brain,
      color: 'bg-accent text-accent-foreground',
      action: () => navigate('/quizzes'),
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header Section */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-foreground tracking-tight">
          Code Insights AI Dashboard
        </h1>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          Transform documents into interactive quizzes using AI. Create documents from URLs or upload markdown files, 
          then generate quizzes for learning and knowledge retention.
        </p>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {quickActions.map((action, index) => {
          const IconComponent = action.icon;
          return (
            <Card 
              key={index}
              className="transition-all duration-200 hover:shadow-lg cursor-pointer border hover:border-primary/20"
              onClick={action.action}
            >
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${action.color}`}>
                    <IconComponent size={24} />
                  </div>
                  <CardTitle className="text-lg">{action.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{action.description}</p>
                <Button 
                  variant="outline" 
                  className="w-full mt-4"
                  onClick={(e) => {
                    e.stopPropagation();
                    action.action();
                  }}
                >
                  Get Started
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Features Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
        <Card className="border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe size={20} />
              From URL
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Extract content from web articles and convert them into clean, structured documents ready for quiz generation.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• AI-powered content extraction</li>
              <li>• Clean markdown conversion</li>
              <li>• Automatic title detection</li>
              <li>• Word count and reading time</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload size={20} />
              File Upload
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Upload your own markdown files to create documents directly from your existing content.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Markdown file support (.md)</li>
              <li>• File size up to 100KB</li>
              <li>• Instant document creation</li>
              <li>• Preserve original formatting</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity Placeholder */}
      <Card className="border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 size={20} />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>Your recent documents and quizzes will appear here.</p>
            <p className="text-sm mt-2">Create your first document to get started!</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};