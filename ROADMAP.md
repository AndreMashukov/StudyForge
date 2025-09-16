# Code Insights AI - Quiz Generator Roadmap

## Project Overview
A Firebase-based web application that generates multiple-choice quizzes from article URLs using Google Generative AI (Gemini 2.5 Pro).

## Tech Stack
- **Monorepo**: NX workspace for managing frontend and backend
- **Frontend**: React + Vite (TypeScript)
- **Styling**: Tailwind CSS
- **Backend**: Firebase Functions (TypeScript)
- **Database**: Firestore
- **Authentication**: Firebase Auth (simplest setup)
- **AI**: Google Generative AI (Gemini 2.5 Pro)
- **Hosting**: Firebase Hosting

## Development Phases

### Phase 1: Project Setup & Foundation (Week 1)
- [ ] Initialize NX monorepo workspace
- [ ] Initialize Firebase project
- [ ] Set up React + Vite app within NX workspace
- [ ] Set up Firebase Functions app within NX workspace
- [ ] Configure Tailwind CSS for styling
- [ ] Configure Firebase SDK in the frontend
- [ ] Configure Firestore security rules
- [ ] Set up basic authentication (email/password)
- [ ] Configure Google Generative AI API access

### Phase 2: Automated Deployment Setup (Week 2)
- [ ] Set up GitHub Actions workflows
- [ ] Configure automated deployment to Firebase Hosting
- [ ] Configure automated deployment of Firebase Functions
- [ ] Set up environment variable management (development, production)
- [ ] Configure Firebase project environments (dev, prod)
- [ ] Implement automated testing pipeline
- [ ] Set up code quality checks (ESLint, TypeScript, Prettier)
- [ ] Configure branch protection rules and deployment gates
- [ ] Set up monitoring and alerting for deployments
- [ ] Create deployment documentation

### Phase 3: Core Backend Functionality (Week 3)
- [ ] Create Firebase Function to fetch URL content
- [ ] Implement web scraping logic for articles/blog posts
- [ ] Set up Gemini 2.5 Pro integration
- [ ] Create quiz generation prompt engineering
- [ ] Implement Firestore data models:
  - URLs collection (original content)
  - Quizzes collection (generated quizzes)
- [ ] Create API endpoints:
  - `POST /generateQuiz` - Generate quiz from URL
  - `GET /quiz/:id` - Retrieve saved quiz

### Phase 4: Frontend Development (Week 4)
- [ ] Create main layout and routing
- [ ] Implement authentication UI (login/signup)
- [ ] Build URL input form
- [ ] Create quiz display component
- [ ] Implement loading states and error handling
- [ ] Add quiz taking functionality
- [ ] Create results/scoring display
- [ ] Implement quiz history (user's generated quizzes)

### Phase 5: Integration & Testing (Week 5)
- [ ] Connect frontend to Firebase Functions
- [ ] Test URL fetching with various article types
- [ ] Validate quiz generation quality
- [ ] Implement error handling for failed requests
- [ ] Test authentication flow
- [ ] Performance optimization
- [ ] Mobile responsiveness

### Phase 6: Production Deployment & Polish (Week 6)
- [ ] Deploy to production using automated pipeline
- [ ] Set up custom domain (if needed)
- [ ] Final testing in production
- [ ] Documentation and README
- [ ] Performance monitoring setup

## File Structure
```
code-insights-ai/                 # NX Monorepo Root
├── apps/
│   ├── web/                      # React frontend app
│   │   ├── src/
│   │   │   ├── components/       # Reusable UI components
│   │   │   │   ├── Auth/
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── LoginForm.tsx
│   │   │   │   │   ├── ILoginForm.ts
│   │   │   │   │   └── LoginForm.styles.ts
│   │   │   │   ├── QuizGenerator/
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── QuizGenerator.tsx
│   │   │   │   │   ├── IQuizGenerator.ts
│   │   │   │   │   └── QuizGenerator.styles.ts
│   │   │   │   ├── QuizDisplay/
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── QuizDisplay.tsx
│   │   │   │   │   ├── IQuizDisplay.ts
│   │   │   │   │   └── QuizDisplay.styles.ts
│   │   │   │   └── Layout/
│   │   │   │       ├── index.ts
│   │   │   │       ├── MainLayout.tsx
│   │   │   │       ├── IMainLayout.ts
│   │   │   │       └── MainLayout.styles.ts
│   │   │   ├── pages/            # Page components
│   │   │   │   ├── HomePage/
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── HomePage.tsx
│   │   │   │   │   ├── HomePageContainer/
│   │   │   │   │   │   ├── index.ts
│   │   │   │   │   │   └── HomePageContainer.tsx
│   │   │   │   │   ├── context/
│   │   │   │   │   │   ├── HomePageContext.ts
│   │   │   │   │   │   ├── HomePageProvider.tsx
│   │   │   │   │   │   └── hooks/
│   │   │   │   │   │       ├── api/
│   │   │   │   │   │       │   └── useFetchQuizzes.ts
│   │   │   │   │   │       ├── useHomePageForm.ts
│   │   │   │   │   │       ├── useHomePageHandlers.ts
│   │   │   │   │   │       └── useHomePageContext.ts
│   │   │   │   │   ├── types/
│   │   │   │   │   │   └── IHomePageContext.ts
│   │   │   │   │   └── utils/
│   │   │   │   │       └── homePageUtils.ts
│   │   │   │   ├── AuthPage/
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── AuthPage.tsx
│   │   │   │   │   └── AuthPageContainer/
│   │   │   │   └── QuizPage/
│   │   │   │       ├── index.ts
│   │   │   │       ├── QuizPage.tsx
│   │   │   │       └── QuizPageContainer/
│   │   │   ├── store/            # Redux store
│   │   │   │   ├── index.ts
│   │   │   │   ├── api/
│   │   │   │   │   ├── baseApi.ts
│   │   │   │   │   ├── Quiz/
│   │   │   │   │   │   ├── QuizApi.ts
│   │   │   │   │   │   └── IQuizApi.ts
│   │   │   │   │   └── Auth/
│   │   │   │   │       ├── AuthApi.ts
│   │   │   │   │       └── IAuthApi.ts
│   │   │   │   └── slices/
│   │   │   │       ├── authSlice.ts
│   │   │   │       ├── uiSlice.ts
│   │   │   │       └── quizSlice.ts
│   │   │   ├── utils/            # Utility functions
│   │   │   │   ├── ProtectedRoute.tsx
│   │   │   │   └── firebase.ts
│   │   │   ├── types/            # Global TypeScript types
│   │   │   │   ├── authTypes.ts
│   │   │   │   └── quizTypes.ts
│   │   │   ├── hooks/            # Global custom hooks
│   │   │   │   └── useAuth.ts
│   │   │   └── App.tsx
│   │   └── project.json
│   └── functions/                # Firebase Functions app
│       ├── src/
│       │   ├── services/
│       │   │   ├── scraper.ts
│       │   │   ├── gemini.ts
│       │   │   └── firestore.ts
│       │   ├── types/
│       │   └── index.ts
│       ├── package.json
│       └── project.json
├── libs/                         # Shared libraries
│   └── shared-types/             # Common TypeScript types
│       ├── src/
│       │   ├── quizTypes.ts
│       │   └── apiTypes.ts
│       └── project.json
├── .github/                      # GitHub Actions workflows
│   └── workflows/
│       ├── ci.yml               # Continuous Integration
│       ├── deploy-dev.yml       # Deploy to development
│       └── deploy-prod.yml      # Deploy to production
├── firestore.rules
├── firebase.json
├── nx.json
├── package.json
└── workspace.json
```

## Data Models

### Firestore Collections

#### `urls` Collection
```typescript
{
  id: string;
  url: string;
  title: string;
  content: string;
  extractedAt: timestamp;
  userId?: string;
}
```

#### `quizzes` Collection
```typescript
{
  id: string;
  urlId: string;
  title: string;
  questions: Array<{
    question: string;
    options: string[]; // 4 options
    correctAnswer: number; // index of correct option
  }>;
  createdAt: timestamp;
  userId?: string;
}
```

## API Endpoints

### Firebase Functions
- `POST /api/generateQuiz`
  - Input: `{ url: string }`
  - Output: `{ quizId: string, quiz: Quiz }`
- `GET /api/quiz/:id`
  - Output: `{ quiz: Quiz }`
- `GET /api/user/quizzes`
  - Output: `{ quizzes: Quiz[] }`

## Key Features

### MVP Features
✅ URL input and content extraction
✅ Multiple-choice quiz generation (4 options)
✅ Quiz display and taking
✅ Simple Firebase authentication
✅ Save generated quizzes
✅ View quiz history

### Future Enhancements (Post-MVP)
- Quiz customization (number of questions, difficulty)
- Different question types (True/False, Short answer)
- PDF support
- Social sharing of quizzes
- Analytics and insights
- Batch processing for multiple URLs

## Technical Considerations

### Monorepo Architecture
- **NX Workspace**: Manage both frontend and Firebase Functions in a single repository
- **Shared Libraries**: Common TypeScript types and utilities shared between apps
- **Build Orchestration**: Use NX for efficient building and testing of both apps
- **Code Sharing**: Share interfaces, types, and utilities between frontend and backend

### Frontend Development
- **Follow Copilot Instructions**: Use the established React development patterns from `.vscode/copilot-instructions.md`
- Implement Material-UI (MUI) v5+ for consistent UI components
- Use React Hook Form with Zod validation for form handling
- Follow TypeScript best practices with proper interfaces
- Implement proper error handling and loading states

### Automated Deployment & CI/CD
- **Multi-Environment Setup**: Development and Production environments
- **GitHub Actions**: Automated workflows for testing, building, and deployment
- **Firebase Integration**: Seamless deployment to Firebase Hosting and Functions
- **Environment Management**: Secure handling of environment variables across environments
- **Quality Gates**: Automated testing, linting, and type checking before deployment
- **Branch Strategy**: 
  - `main` branch → Production deployment
  - `develop` branch → Development deployment
  - Feature branches → Development deployment for testing
- **Deployment Pipeline**:
  1. Code quality checks (ESLint, TypeScript, Prettier)
  2. Unit and integration tests
  3. Build NX applications
  4. Deploy to appropriate Firebase environment
  5. Run smoke tests
  6. Notification of deployment status

### Content Extraction
- Use libraries like `cheerio` or `puppeteer` for web scraping
- Handle different article formats (Medium, AWS Docs, etc.)
- Extract main content while filtering ads/navigation

### AI Integration
- Craft effective prompts for Gemini 2.5 Pro
- Ensure consistent question quality
- Handle API rate limits and errors gracefully

### Security
- Implement Firestore security rules
- Validate URLs to prevent malicious content
- Rate limiting on quiz generation

### Performance
- Cache frequently accessed content
- Optimize Firestore queries
- Lazy loading for quiz components

## Environment Variables Needed
```
GOOGLE_APPLICATION_CREDENTIALS
GEMINI_API_KEY
FIREBASE_PROJECT_ID
```

## Testing Strategy
- Unit tests for utility functions
- Integration tests for Firebase Functions
- E2E tests for critical user flows
- Manual testing with various article URLs

## Success Metrics
- Successful quiz generation rate > 95%
- Average quiz completion time < 5 minutes
- User engagement (return visits)
- Quiz quality feedback

---

**Next Steps**: Start with Phase 1 - Project Setup & Foundation
