---
applyTo: '**'
---

# GitHub Copilot Instructions for Code Insights AI

## Project Overview

This is a React web application built with TypeScript, shadcn/ui components, Tailwind CSS, React Router DOM v6, Firebase Authentication, NX workspace, and modern React patterns. Follow these guidelines for consistent code generation across the application.

## Technology Stack

- **Build Tool**: Vite with NX workspace
- **Package Manager**: Yarn
- **Framework**: React 19+ with TypeScript
- **UI Library**: shadcn/ui with Radix UI primitives
- **Styling**: Tailwind CSS with CSS custom properties (CSS variables)
- **Routing**: React Router DOM v6
- **Authentication**: Firebase Authentication with react-firebase-hooks
- **State Management**: React Context API and useState/useEffect hooks
- **Icons**: Lucide React icons and custom SVG icons
- **Form Handling**: Native HTML forms with controlled components

## UI Components System

### shadcn/ui Components
The project uses shadcn/ui as the primary component library, which provides:

#### Available Components
- **Button** (`/web/src/components/ui/button.tsx`)
  - Variants: `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`
  - Sizes: `default`, `sm`, `lg`, `icon`
  - Built with `class-variance-authority` for consistent styling

- **Card** (`/web/src/components/ui/card.tsx`)
  - Components: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`
  - Used for feature cards, auth forms, and content containers

- **Input** (`/web/src/components/ui/input.tsx`)
  - Standard text input with consistent styling
  - Supports all HTML input types and attributes

- **Label** (`/web/src/components/ui/label.tsx`)
  - Built with `@radix-ui/react-label` for accessibility
  - Used for form field labels with proper associations

- **Icon** (`/web/src/components/ui/icon.tsx`)
  - Custom wrapper for SVG icons
  - Supports size prop and className customization

#### Component Usage Examples
```tsx
// Button usage
<Button variant="default" size="lg">Primary Action</Button>
<Button variant="outline">Secondary Action</Button>
<Button variant="ghost" size="icon"><Icon>...</Icon></Button>

// Card usage
<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
  </CardHeader>
  <CardContent>
    Content goes here
  </CardContent>
</Card>

// Form elements
<div>
  <Label htmlFor="email">Email Address</Label>
  <Input id="email" type="email" placeholder="Enter email" />
</div>
```

### Design System

#### Color System (CSS Variables)
The project uses a comprehensive color system with CSS custom properties:

```css
:root {
  --background: 0 0 0;           /* Pure black background */
  --foreground: 255 255 255;     /* White text */
  --card: 17 17 17;              /* Dark gray cards */
  --primary: 139 92 246;         /* Purple primary */
  --secondary: 39 39 42;         /* Dark gray secondary */
  --accent: 34 197 94;           /* Green accent */
  --muted: 39 39 42;             /* Muted backgrounds */
  --destructive: 239 68 68;      /* Red for errors */
  --border: 39 39 42;            /* Border colors */
  --input: 28 28 30;             /* Input backgrounds */
  --ring: 139 92 246;            /* Focus rings */
}
```

#### Typography & Spacing
- **Font**: System font stack with fallback to sans-serif
- **Spacing**: Tailwind's spacing scale (0.25rem increments)
- **Border Radius**: `--radius: 0.75rem` for consistent rounded corners

### Styling Approach

#### Tailwind CSS Classes
Use Tailwind utility classes for styling:
```tsx
<div className="min-h-screen bg-background text-foreground">
  <div className="max-w-4xl mx-auto p-6 space-y-8">
    <h1 className="text-3xl font-bold text-foreground">Title</h1>
    <p className="text-muted-foreground">Description text</p>
  </div>
</div>
```

#### Component Styling
- Use `cn()` utility function for conditional classes
- Combine Tailwind classes with component variants
- Maintain consistent hover and focus states

## Dependency Management

### Installing Dependencies in NX Workspace

When adding new dependencies to the NX monorepo, always use the workspace flag to install at the root level:

```bash
# Install production dependencies at workspace root
yarn add react react-dom firebase react-firebase-hooks

# For shadcn/ui components, install required Radix UI primitives:
yarn add @radix-ui/react-slot @radix-ui/react-label

# Install development dependencies at workspace root
yarn add -D @types/react @types/react-dom typescript

# Use --ignore-engines flag if there are Node.js version compatibility issues
yarn add @radix-ui/react-label --ignore-engines

# Remove dependencies from workspace root
yarn remove package-name
```

**Important**: Always install dependencies at the root level for the monorepo. Use `--ignore-engines` flag when encountering Node.js version compatibility issues with some packages.

### Key Dependencies

#### UI & Styling
- `@radix-ui/react-slot` - Primitive for shadcn/ui Button component
- `@radix-ui/react-label` - Accessible label component
- `class-variance-authority` - Component variant management
- `clsx` - Conditional className utility
- `tailwind-merge` - Tailwind class merging utility
- `tailwindcss-animate` - Animation utilities
- `lucide-react` - Icon library

#### Firebase & Authentication
- `firebase` - Firebase SDK
- `react-firebase-hooks` - React hooks for Firebase

#### Routing & Core
- `react-router-dom` - Client-side routing
- `react` & `react-dom` - React framework

## Code Style and Structure

- Write concise, technical TypeScript code with accurate examples
- Use functional and declarative programming patterns; avoid classes
- Prefer iteration and modularization over code duplication
- Use descriptive variable names with auxiliary verbs (e.g., isLoading, hasError)
- Structure files: exported component, subcomponents, helpers, static content, types
- Follow [shadcn/ui Documentation](https://ui.shadcn.com/) for component usage and theming
- Use NX MCP server to access NX documentation and workspace information
- Follow [React Router DOM v6 Documentation](https://reactrouter.com/en/main) for routing and navigation
- Favor named exports for components
- Use TypeScript for all code; prefer interfaces over types

## File and Directory Structure

### Source Code Location
All source code should reside in the `web/src` directory:
- **Components**: `web/src/components/`
- **UI Components**: `web/src/components/ui/` (shadcn/ui components)
- **Contexts**: `web/src/contexts/`
- **Config**: `web/src/config/`
- **Utils**: `web/src/lib/`
- **App**: `web/src/app/`


### Component Structure
Each component should have its own directory in `web/src/components/`:
```
web/src/components/ComponentName/
├── index.ts                    # Exports from the component directory
├── ComponentName.tsx           # Main component implementation
├── IComponentName.ts           # TypeScript interface for component props
└── ComponentName.styles.ts     # Component-specific styles using MUI or Tailwind styling
```

For shadcn/ui components, each UI component (e.g., Button, Label, Card) should also be placed in its own directory under `web/src/components/ui/`:
```
web/src/components/ui/Button/
├── index.ts
├── Button.tsx
├── IButton.ts
└── Button.styles.ts
web/src/components/ui/Label/
├── index.ts
├── Label.tsx
├── ILabel.ts
└── Label.styles.ts
```
This structure ensures clear separation, easier maintenance, and scalability for all UI and application components.

### File Responsibilities

- **Component files**: Direct exports with TypeScript interfaces inline
  ```typescript
  // For components WITH props:
  interface ComponentProps {
    prop1: string;
    prop2?: number;
  }

  export const ComponentName = ({ prop1, prop2 }: ComponentProps) => {
    // Component implementation
  };

  // For components WITHOUT props:
  export const ComponentName = () => {
    // Component implementation
  };
  ```
  export * from "./ComponentName";
  export * from "./IComponentName";
  ```

- **IComponentName.ts**: Defines the component's props interface
  ```typescript
  export interface IComponentName {
    prop1: type1;
    prop2?: type2;
    // ... other props
  }
  ```

- **ComponentName.styles.ts**: Contains component-specific styles using CSS modules or styled-components patterns
  ```typescript
  import { cn } from "@/lib/utils";

  export const componentStyles = {
    container: "flex flex-col gap-4 p-4 rounded-lg bg-background border",
    title: "text-2xl font-semibold text-foreground mb-4",
    content: "space-y-2",
  } as const;

  // For complex styling needs
  export const getVariantStyles = (variant: "default" | "compact") => {
    return cn(
      componentStyles.container,
      variant === "compact" && "p-2 gap-2"
    );
  };
  ```

- **ComponentName.tsx**: Main component implementation
  ```typescript
  import { Card, CardContent } from "./ui/card";
  import { IComponentName } from "./IComponentName";
  import { componentStyles } from "./ComponentName.styles";

  export const ComponentName = ({ prop1, prop2 }: IComponentName) => {
    return (
      <Card className={componentStyles.container}>
        <CardContent className={componentStyles.content}>
          {/* Implementation */}
        </CardContent>
      </Card>
    );
  };
  ```

### Page Structure
Pages should be located in `apps/main/src/pages/`:
```
apps/main/src/pages/FeatureNamePage/
├── index.ts
├── FeatureNamePage.tsx
├── FeatureNamePageContainer/
│   ├── index.ts
│   └── FeatureNamePageContainer.tsx
├── context/
│   ├── FeatureNamePageContext.ts
│   ├── FeatureNamePageProvider.tsx
│   └── hooks/
│       ├── api/                          # ONLY fetch/query hooks
│       │   ├── useFetchFeaturePageData.ts # Query hooks with RTK Query
│       │   ├── useFetchUserProfile.ts    # Additional query hooks
│       │   └── useFetchCompanyList.ts    # Other fetch operations
│       ├── useFeaturePageForm.ts         # Form hooks
│       ├── useFeaturePageSchema.ts       # Schema hooks
│       ├── useFeaturePageHandlers.ts     # Event handlers (mutations, no useEffect)
│       ├── useFeaturePageEffects.ts      # Side effects (useEffect-based logic)
│       └── useFeaturePageContext.ts     # Context consumer
├── types/
│   ├── IFeaturePageHandlers.ts
│   └── IFeaturePageContext.ts
└── utils/
    └── featurePageUtils.ts
```

## Naming Conventions

- Components: `PascalCase` (e.g., `UserProfile`)
- Pages: `FeatureNamePage` (e.g., `DashboardPage`)
- Containers: `FeatureNamePageContainer`
- Contexts: `FeatureNamePageContext`
- Hooks: `useFeatureName` (e.g., `useUserProfile`)
- Handlers: Always prefix with "handle" (e.g., `handleSubmit`)
- Interfaces: Prefix with "I" (e.g., `IUserProfile`)
- API types: Suffix with "Api" (e.g., `IUserProfileApi`)
- Pages are located in `apps/main/src/pages/`

## TypeScript Guidelines

- Use interfaces for all component props and data structures
- Define proper types for all functions and variables
- Use generic types where appropriate
- Leverage TypeScript's strict mode features
- Create separate interface files for complex types
- **Never create empty interfaces** - Use `Record<string, never>` type or omit props parameter if component doesn't need props

## Zod Schema Validation

### Schema Structure and Best Practices

All form validation and data validation should use Zod schemas. Create separate schema hooks for reusability and type safety:

```typescript
// Example: Authentication form schema
import { z } from "zod";

export const authFormSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 
      "Password must contain uppercase, lowercase, and number"),
});

export type AuthFormData = z.infer<typeof authFormSchema>;
```

### Schema Hooks Pattern

Create dedicated hooks for schema management:

```typescript
// hooks/useAuthSchema.ts
import { useCallback } from "react";
import { z } from "zod";

const createAuthSchema = () => z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().optional(),
}).refine((data) => {
  if (data.confirmPassword && data.password !== data.confirmPassword) {
    return false;
  }
  return true;
}, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export type AuthFormData = z.infer<ReturnType<typeof createAuthSchema>>;

export const useAuthSchema = () => {
  const schema = useCallback(() => createAuthSchema(), []);
  
  return {
    schema: schema(),
    type: {} as AuthFormData, // For type inference
  };
};
```

### Form Validation with Zod

#### Client-Side Validation
```typescript
import { useState } from 'react';
import { authFormSchema, type AuthFormData } from './schemas/authSchema';

export const AuthForm = () => {
  const [formData, setFormData] = useState<AuthFormData>({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (data: AuthFormData) => {
    try {
      authFormSchema.parse(data);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm(formData)) {
      // Submit form
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <Label htmlFor="email">Email Address</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
          className={errors.email ? 'border-destructive' : ''}
        />
        {errors.email && (
          <p className="text-destructive text-sm mt-1">{errors.email}</p>
        )}
      </div>
    </form>
  );
};
```

### Multi-Step Form Schemas

For complex multi-step forms:

```typescript
// Multi-step form schema example
const useMultiStepFormSchema = () => {
  const step1Schema = z.object({
    personalInfo: z.object({
      firstName: z.string().min(1, "First name is required"),
      lastName: z.string().min(1, "Last name is required"),
      dateOfBirth: z.string().refine((date) => {
        const age = new Date().getFullYear() - new Date(date).getFullYear();
        return age >= 18;
      }, "Must be at least 18 years old"),
    }),
  });

  const step2Schema = z.object({
    contactInfo: z.object({
      email: z.string().email("Invalid email address"),
      phone: z.string().regex(/^\+?[\d\s-()]+$/, "Invalid phone number"),
    }),
  });

  const fullSchema = step1Schema.merge(step2Schema);

  return {
    step1Schema,
    step2Schema,
    fullSchema,
    validateStep: (step: number, data: any) => {
      if (step === 1) return step1Schema.safeParse(data);
      if (step === 2) return step2Schema.safeParse(data);
      return fullSchema.safeParse(data);
    },
  };
};
```

### API Data Validation

Use Zod for validating API responses and requests:

```typescript
// API response validation
export const userProfileSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  avatar: z.string().url().optional(),
  preferences: z.object({
    theme: z.enum(['light', 'dark']),
    notifications: z.boolean(),
  }),
});

export type UserProfile = z.infer<typeof userProfileSchema>;

// Validate API response
export const validateApiResponse = <T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T => {
  try {
    return schema.parse(data);
  } catch (error) {
    console.error('API response validation failed:', error);
    throw new Error('Invalid API response format');
  }
};
```

### Common Validation Patterns

```typescript
// Common validation schemas
export const commonSchemas = {
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 
      "Password must contain uppercase, lowercase, and number"),
  url: z.string().url("Invalid URL format"),
  phone: z.string().regex(/^\+?[\d\s-()]+$/, "Invalid phone number"),
  positiveNumber: z.number().positive("Must be a positive number"),
  nonEmptyString: z.string().min(1, "This field is required"),
  optionalString: z.string().optional(),
};

// Reusable validation helpers
export const createRequiredField = (fieldName: string) =>
  z.string().min(1, `${fieldName} is required`);

export const createOptionalField = () =>
  z.string().optional();

export const createEmailField = () =>
  z.string().min(1, "Email is required").email("Invalid email address");
```

### Error Handling

```typescript
// Centralized error handling for Zod validation
export const handleZodError = (error: z.ZodError): Record<string, string> => {
  const fieldErrors: Record<string, string> = {};
  
  error.errors.forEach((err) => {
    const fieldPath = err.path.join('.');
    fieldErrors[fieldPath] = err.message;
  });
  
  return fieldErrors;
};

// Usage in components
try {
  const validatedData = schema.parse(formData);
  // Process valid data
} catch (error) {
  if (error instanceof z.ZodError) {
    setFieldErrors(handleZodError(error));
  }
}
```

## Authentication Architecture

### Firebase Authentication
This project uses Firebase Authentication with React Firebase Hooks:

- **Authentication Flow**: Firebase Auth with email/password
- **Authentication State**: Managed with React Context and react-firebase-hooks
- **User Management**: Firebase handles user creation, sign-in, and session management
- **Protected Routes**: Components check authentication state before rendering

### Authentication API Structure
```typescript
// Firebase Auth setup
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  // Your Firebase config
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
```

### Authentication Context
```typescript
// AuthContext usage
const { user, loading } = useAuth();

// Firebase hooks
const [signInWithEmailAndPassword, user, loading, error] = useSignInWithEmailAndPassword(auth);
const [createUserWithEmailAndPassword, user, loading, error] = useCreateUserWithEmailAndPassword(auth);
```

## Form Handling

### Native HTML Forms
This project uses controlled components with native HTML forms:

### Native HTML Forms
This project uses controlled components with native HTML forms:

```typescript
// Form state management
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');

// Form submission
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  // Handle form submission
};

// Form JSX
<form onSubmit={handleSubmit} className="space-y-6">
  <div>
    <Label htmlFor="email">Email Address</Label>
    <Input
      id="email"
      type="email"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
      placeholder="Enter your email"
      required
    />
  </div>
  <Button type="submit" disabled={loading}>
    {loading ? 'Processing...' : 'Submit'}
  </Button>
</form>
```

### Form Validation
- **Always use Zod for all form validation** - Create schema hooks for reusability and type safety
- Use HTML5 validation attributes as fallbacks (required, type, pattern)
- Implement Zod validation in form submission handlers
- Display validation errors from Zod error objects using conditional rendering
- Leverage Firebase Auth error handling for authentication forms alongside Zod validation
- Create reusable validation patterns using common Zod schemas

## Navigation and Routing with React Router DOM v6

### Route Configuration
```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/profile" element={<UserProfile />} />
    </Routes>
  </BrowserRouter>
);
```

### Protected Routes Pattern
```typescript
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};
```

### Multi-Step Form Pattern

```typescript
// For complex multi-step forms
const useMultiStepFeaturePageSchema = () => {
  const step1Schema = z.object({
    personalInfo: z.object({
      firstName: z.string().min(1, "Required"),
      lastName: z.string().min(1, "Required"),
    }),
  });

  const step2Schema = z.object({
    contactInfo: z.object({
      email: z.string().email(),
      phone: z.string().min(10),
    }),
  });

  const fullSchema = step1Schema.merge(step2Schema);

  return {
    step1Schema,
    step2Schema,
    fullSchema,
  };
};
```

## State Management with Redux Toolkit

### Store Structure
```
apps/main/src/store/
├── index.ts                    # Store configuration and root state
├── api/                        # RTK Query API definitions
│   ├── baseApi.ts             # Base API configuration (session-based auth)
│   ├── FeatureName/           # Feature-specific API endpoints
│   │   ├── FeatureNameApi.ts  # API endpoints for feature
│   │   └── IFeatureNameApi.ts # TypeScript interfaces for API responses
│   └── utils/                 # API utilities and Axios helpers
│       ├── axiosGeneric.ts    # Generic request handling with Axios
│       ├── axiosMultipart.ts  # FormData/multipart request handling
│       ├── logging.ts         # API error and debug logging
│       └── errorHandling.ts   # Global error handling (optional)
├── slices/                    # Redux Toolkit slices
│   ├── authSlice.ts          # Session-based authentication state
│   ├── uiSlice.ts            # Global UI state
│   ├── featureNamePageSlice.ts # Page-specific state
│   └── userPreferencesSlice.ts # User preferences
└── persistConfig.ts          # Redux persist configuration
```

### Axios Utility Files Structure

When using Axios with RTK Query, organize utilities into separate files for maintainability:

#### axiosGeneric.ts - Standard Request Handling
- Handles regular JSON requests (GET, POST, PUT, DELETE)
- Manages authentication headers and request configuration
- Provides debug logging for development
- Handles response processing and blob responses

#### axiosMultipart.ts - File Upload Handling
- Specialized handling for FormData/multipart requests
- Clean axios instance to avoid header pollution
- Proper boundary handling for file uploads
- FormData debugging and logging

#### logging.ts - Debug and Error Logging
- Centralized logging for API requests and errors
- Sanitizes sensitive data (tokens, credentials)
- Development-only logging with detailed request info
- Network error diagnosis and debugging

### Store Configuration (store/index.ts)

```typescript
import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from "redux-persist";
import { combineReducers } from "@reduxjs/toolkit";
import storage from "redux-persist/lib/storage"; // localStorage for web

// Import base API
import { baseApi } from "./api/baseApi";

// Import slice reducers
import authReducer, { checkAuthState } from "./slices/authSlice";
import uiReducer from "./slices/uiSlice";
import userPreferencesReducer from "./slices/userPreferencesSlice";
import featureNamePageReducer from "./slices/featureNamePageSlice";

// Persist configuration
const persistConfig = {
  key: "root",
  storage,
  whitelist: ["auth", "userPreferences"], // Only persist these slices
  blacklist: ["ui"], // Never persist UI state
};

// Root reducer
const rootReducer = combineReducers({
  auth: authReducer,
  ui: uiReducer,
  userPreferences: userPreferencesReducer,
  featureNamePage: featureNamePageReducer,
  [baseApi.reducerPath]: baseApi.reducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

// Configure store
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
        // Ignore paths that contain non-serializable values
        ignoredPaths: ["notifications.items"],
      },
    }).concat(baseApi.middleware),
  devTools: process.env.NODE_ENV !== "production",
});

// Enable refetchOnFocus and refetchOnReconnect
setupListeners(store.dispatch);

// Create persistor
export const persistor = persistStore(store);

// Check authentication state when store is created
store.dispatch(checkAuthState());

// Export types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Typed hooks
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
```

### Base API Configuration with Axios (store/api/baseApi.ts)

For complex applications requiring advanced request handling, file uploads, or specialized error handling, use Axios instead of fetchBaseQuery. This project uses session-based authentication stored in localStorage:

```typescript
import { createApi } from "@reduxjs/toolkit/query/react";
import type { BaseQueryFn } from "@reduxjs/toolkit/query";
import type { AxiosRequestConfig, AxiosError } from "axios";
import { RootState } from "../index";
import { logout } from "../slices/authSlice";
import {
  executeMultipartRequest,
  logMultipartNetworkError,
  type MultipartRequestOptions,
} from "./utils/axiosMultipart";
import {
  executeGenericRequest,
  logGenericRequestDebug,
  logGenericNetworkError,
  logGenericSuccess,
  processBlobResponse,
  processResponseData,
  type GenericRequestOptions,
} from "./utils/axiosGeneric";
import { logApiError, logNetworkError } from "./utils/logging";

const axiosBaseQuery =
  (
    { baseUrl }: { baseUrl: string } = { baseUrl: "" },
  ): BaseQueryFn<
    {
      url: string;
      method: AxiosRequestConfig["method"];
      data?: AxiosRequestConfig["data"];
      params?: AxiosRequestConfig["params"];
      headers?: AxiosRequestConfig["headers"];
      responseType?: AxiosRequestConfig["responseType"];
    },
    unknown,
    unknown
  > =>
  async ({ url, method, data, params, headers, responseType }, { getState, dispatch }) => {
    try {
      // Prepare request headers (no token-based auth required for session-based auth)
      let requestHeaders: Record<string, string> = {
        "User-Agent": "AppName/1.0 (Web App)",
        ...headers,
      };

      const isFormData = data instanceof FormData;

      if (isFormData) {
        // Handle multipart FormData request
        const multipartOptions: MultipartRequestOptions = {
          baseUrl,
          url,
          method: method || "GET",
          data,
          params,
          requestHeaders,
          responseType,
        };

        const result = await executeMultipartRequest(multipartOptions);

        // Handle blob response if needed
        if (responseType === "blob" && result.data instanceof Blob) {
          return await processBlobResponse(result);
        }

        // Log success and process response
        logGenericSuccess(result.data);
        return processResponseData(result);
      } else {
        // Handle generic request
        const genericOptions: GenericRequestOptions = {
          baseUrl,
          url,
          method: method || "GET",
          data,
          params,
          requestHeaders,
          responseType,
        };

        // Debug logging for generic requests
        logGenericRequestDebug(genericOptions, token || undefined);

        const result = await executeGenericRequest(genericOptions);

        // Handle blob response if needed
        if (responseType === "blob" && result.data instanceof Blob) {
          return await processBlobResponse(result);
        }

        // Log success and process response
        logGenericSuccess(result.data);
        return processResponseData(result);
      }
    } catch (axiosError) {
      const err = axiosError as AxiosError;

      // Debug logging for errors
      logApiError(err);

      // Special handling for network errors
      if (err.message === "Network Error" && !err.response) {
        const isFormData = data instanceof FormData;
        logNetworkError(
          baseUrl,
          url,
          method || "GET",
          err.config,
          isFormData,
          logMultipartNetworkError,
          logGenericNetworkError,
        );
      }

      // Handle 401 Unauthorized error
      if (err.response?.status === 401) {
        // Reset auth state when we get a 401 (clear session)
        dispatch(logout());
      }

      return {
        error: {
          status: err.response?.status || (err.message === "Network Error" ? 0 : undefined),
          data: err.response?.data || err.message,
        },
      };
    }
  };

// Create the base API with Axios
export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: axiosBaseQuery({
    baseUrl: process.env.REACT_APP_API_BASE_URL || "",
  }),
  endpoints: () => ({}),
  tagTypes: ["User", "Company", "Offers", "Notifications", "Profile"],
});
```

### Alternative: Simple fetchBaseQuery Configuration

For basic applications without file uploads or complex request handling, use the simpler fetchBaseQuery:

```typescript
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query";
import { RootState } from "../index";
import { logout } from "../slices/authSlice";

// Custom base query with session-based auth handling
const baseQueryWithAuth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const baseQuery = fetchBaseQuery({
    baseUrl: process.env.REACT_APP_API_BASE_URL || "",
    prepareHeaders: (headers, { getState }) => {
      // Session-based auth: no tokens needed
      headers.set("Content-Type", "application/json");
      return headers;
    },
  });

  const result = await baseQuery(args, api, extraOptions);

  // Handle 401 errors globally (clear session)
  if (result.error && result.error.status === 401) {
    api.dispatch(logout());
  }

  return result;
};

// Create the base API
export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithAuth,
  tagTypes: [
    "User",
    "Company",
    "Offers",
    "Notifications",
    "Profile",
  ],
  endpoints: () => ({}),
});
```

### Feature API Structure (store/api/Company/CompanyApi.ts)

```typescript
import { baseApi } from "../baseApi";
import { ICompanyApi, ICompanyListResponse } from "./ICompanyApi";

export const companyApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getCompany: builder.query<ICompanyApi, void>({
      query: () => ({
        url: "/company",
        method: "GET",
      }),
      providesTags: ["Company"],
      keepUnusedDataFor: 300, // 5 minutes
    }),

    getCompanies: builder.query<ICompanyListResponse, { page?: number; limit?: number }>({
      query: ({ page = 1, limit = 10 } = {}) => ({
        url: "/companies",
        method: "GET",
        params: { page, limit },
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map(({ id }) => ({ type: "Company" as const, id })),
              { type: "Company", id: "LIST" },
            ]
          : [{ type: "Company", id: "LIST" }],
    }),

    updateCompany: builder.mutation<ICompanyApi, { id: string; data: Partial<ICompanyApi> }>({
      query: ({ id, data }) => ({
        url: `/company/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: "Company", id }],
    }),

    createCompany: builder.mutation<ICompanyApi, Omit<ICompanyApi, "id">>({
      query: (data) => ({
        url: "/company",
        method: "POST",
        body: data,
      }),
      invalidatesTags: [{ type: "Company", id: "LIST" }],
    }),
  }),
});

export const {
  useGetCompanyQuery,
  useGetCompaniesQuery,
  useUpdateCompanyMutation,
  useCreateCompanyMutation,
} = companyApi;
```

### API Hook Organization
- **API Hooks** (`context/hooks/api/`): Data fetching with RTK Query
- **Handlers** (`useFeaturePageHandlers`): Mutations, business logic, no useEffect
- **Effects** (`useFeaturePageEffects`): Non-fetch related useEffect only
- **Context**: Orchestrates API hooks, handlers, and effects

### Redux Best Practices
- Use RTK Query for all API calls
- Never duplicate API data in local state
- Use Redux slices for global and page-specific state
- Access Redux state with useSelector in components
- Handle mutations in handlers, not effects
- Use session-based authentication with localStorage persistence

### When to Use Axios vs fetchBaseQuery

#### Use Axios when you need:
- File uploads with FormData/multipart requests
- Advanced request/response interceptors
- Custom error handling and logging
- Blob/binary response handling
- Session-based authentication flows
- Detailed debug logging for development
- Request/response transformation beyond what fetchBaseQuery offers

#### Use fetchBaseQuery when:
- Building simple CRUD applications
- Working with standard JSON APIs
- You don't need file upload capabilities
- Simple token-based authentication requirements
- You prefer smaller bundle size
- Standard error handling is sufficient

## Navigation and Routing with React Router v7

### Protected Routes Pattern

All routes except `/auth` should be protected:

```typescript
// utils/ProtectedRoute.tsx
import { Navigate, useLocation } from "react-router";
import { useSelector } from "react-redux";
import { selectIsAuthenticated } from "../store/slices/authSlice";

interface IProtectedRoute {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: IProtectedRoute) => {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
```

### Route Configuration

```typescript
// routes.tsx
import { type RouteConfig, route, index } from "@react-router/dev/routes";

export default [
  index("./app.tsx"),
  route("auth", "./pages/AuthPage/AuthPage.tsx"),
  route("dashboard", "./pages/DashboardPage/DashboardPage.tsx"),
  route("profile", "./pages/ProfilePage/ProfilePage.tsx"),
  // Add more protected routes here
] satisfies RouteConfig;
```

### Page Component with Route Integration

```typescript
// pages/FeatureNamePage/FeatureNamePage.tsx
import { useParams, useSearchParams } from "react-router";
import { ProtectedRoute } from "../../utils/ProtectedRoute";
import { FeatureNamePageProvider } from "./context/FeatureNamePageProvider";
import { FeatureNamePageContainer } from "./FeatureNamePageContainer";

export const FeatureNamePage = () => {
  const params = useParams();
  const [searchParams] = useSearchParams();

  return (
    <ProtectedRoute>
      <FeatureNamePageProvider>
        <FeatureNamePageContainer />
      </FeatureNamePageProvider>
    </ProtectedRoute>
  );
};
```

## Architecture Patterns

### Context-Based Page Architecture
1. **Page Component**: Sets up Context Provider and routing
2. **Page Container**: Connects to context using consumer hook
3. **Presentational Components**: Render UI based on props from context
4. **Custom Hooks**: Encapsulate logic (forms, handlers, API calls)
5. **Redux Integration**: Direct access with useSelector/useDispatch

### Hook Responsibilities
- **API Hooks**: RTK Query + refetch logic + fetch-related useEffect
- **Handlers**: Business logic, mutations, user feedback (NO useEffect)
- **Effects**: Non-fetch useEffect logic only
- **Form Hooks**: React Hook Form integration
- **Schema Hooks**: Zod validation schemas

### API Query Hooks (context/hooks/api/useFetchFeaturePageData.ts)

```typescript
import { useCallback, useEffect } from "react";
import { useLocation } from "react-router";
import { useGetCompaniesQuery } from "../../../store/api/Company/CompanyApi";
import { useAppSelector } from "../../../store";
import { selectFilters, selectPagination, selectSortConfig } from "../../../store/slices/featureNamePageSlice";

export const useFetchFeaturePageData = () => {
  const location = useLocation();
  const filters = useAppSelector(selectFilters);
  const pagination = useAppSelector(selectPagination);
  const sortConfig = useAppSelector(selectSortConfig);

  // RTK Query hook with parameters from Redux state
  const queryResult = useGetCompaniesQuery({
    page: pagination.page,
    limit: pagination.limit,
    search: filters.search,
    category: filters.category,
    sortBy: sortConfig.field,
    sortDirection: sortConfig.direction,
  });

  // Refetch when navigating back to this page (fetch-related effect)
  useEffect(() => {
    queryResult.refetch();
  }, [location.pathname, queryResult.refetch]);

  // Refetch on window focus (fetch-related effect)
  useEffect(() => {
    const handleWindowFocus = () => {
      queryResult.refetch();
    };

    window.addEventListener("focus", handleWindowFocus);
    
    return () => {
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [queryResult.refetch]);

  return queryResult;
};
```

### Handlers Hook (context/hooks/useFeaturePageHandlers.ts)

```typescript
import { useCallback } from "react";
import { useNavigate } from "react-router";
import { useSnackbar } from "notistack";
import { useAppDispatch } from "../../store";
import { 
  useCreateCompanyMutation, 
  useUpdateCompanyMutation,
  useDeleteCompanyMutation 
} from "../../store/api/Company/CompanyApi";
import { setModalOpen, updateFilters } from "../../store/slices/featureNamePageSlice";
import { ICompanyCreateRequest, ICompanyUpdateRequest } from "../../store/api/Company/ICompanyApi";

export const useFeaturePageHandlers = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { enqueueSnackbar } = useSnackbar();

  // RTK Query mutation hooks used directly in handlers
  const [createCompany, { isLoading: isCreating }] = useCreateCompanyMutation();
  const [updateCompany, { isLoading: isUpdating }] = useUpdateCompanyMutation();
  const [deleteCompany, { isLoading: isDeleting }] = useDeleteCompanyMutation();

  const handleCreateCompany = useCallback(async (data: ICompanyCreateRequest) => {
    try {
      const result = await createCompany(data).unwrap();
      enqueueSnackbar("Company created successfully", { variant: "success" });
      navigate(`/companies/${result.id}`);
      return { success: true, data: result };
    } catch (error) {
      const errorMessage = (error as any)?.data?.message || "Creation failed";
      enqueueSnackbar(errorMessage, { variant: "error" });
      return { success: false, error: errorMessage };
    }
  }, [createCompany, enqueueSnackbar, navigate]);

  const handleUpdateCompany = useCallback(async (id: string, data: ICompanyUpdateRequest) => {
    try {
      await updateCompany({ id, data }).unwrap();
      enqueueSnackbar("Company updated successfully", { variant: "success" });
      return { success: true };
    } catch (error) {
      const errorMessage = (error as any)?.data?.message || "Update failed";
      enqueueSnackbar(errorMessage, { variant: "error" });
      return { success: false, error: errorMessage };
    }
  }, [updateCompany, enqueueSnackbar]);

  const handleOpenModal = useCallback(() => {
    dispatch(setModalOpen(true));
  }, [dispatch]);

  const handleCloseModal = useCallback(() => {
    dispatch(setModalOpen(false));
  }, [dispatch]);

  const handleUpdateFilters = useCallback((filters: any) => {
    dispatch(updateFilters(filters));
  }, [dispatch]);

  const handleNavigateToDetail = useCallback((id: string) => {
    navigate(`/companies/${id}`);
  }, [navigate]);

  return {
    handleCreateCompany,
    handleUpdateCompany,
    handleOpenModal,
    handleCloseModal,
    handleUpdateFilters,
    handleNavigateToDetail,
    isCreating,
    isUpdating,
    isDeleting,
  };
};
```

### Effects Hook (context/hooks/useFeaturePageEffects.ts)

```typescript
import { useEffect } from "react";

interface IUseFeaturePageEffects {
  onUserActivity?: () => void;
  onTimerExpiry?: () => void;
  onExternalEvent?: () => void;
}

export const useFeaturePageEffects = ({ 
  onUserActivity, 
  onTimerExpiry, 
  onExternalEvent 
}: IUseFeaturePageEffects) => {
  
  // Example: Track user activity (non-fetch related)
  useEffect(() => {
    const handleUserActivity = () => {
      if (onUserActivity) {
        onUserActivity();
      }
    };

    if (onUserActivity) {
      document.addEventListener("mousedown", handleUserActivity);
      document.addEventListener("keydown", handleUserActivity);
      
      return () => {
        document.removeEventListener("mousedown", handleUserActivity);
        document.removeEventListener("keydown", handleUserActivity);
      };
    }
  }, [onUserActivity]);

  // Example: Timer-based effects (non-fetch related)
  useEffect(() => {
    if (onTimerExpiry) {
      const timer = setTimeout(() => {
        onTimerExpiry();
      }, 300000); // 5 minutes

      return () => clearTimeout(timer);
    }
  }, [onTimerExpiry]);

  // Example: External event listeners (non-fetch related)
  useEffect(() => {
    if (onExternalEvent) {
      const handleStorageChange = () => {
        onExternalEvent();
      };

      window.addEventListener("storage", handleStorageChange);
      
      return () => {
        window.removeEventListener("storage", handleStorageChange);
      };
    }
  }, [onExternalEvent]);
};
```

### Context Integration with Proper Architecture

```typescript
// context/FeatureNamePageProvider.tsx
import React, { createContext, ReactNode } from "react";
import { useFetchFeaturePageData } from "./hooks/api/useFetchFeaturePageData";
import { useFetchUserProfile } from "./hooks/api/useFetchUserProfile";
import { useFeaturePageForm } from "./hooks/useFeaturePageForm";
import { useFeaturePageHandlers } from "./hooks/useFeaturePageHandlers";
import { useFeaturePageEffects } from "./hooks/useFeaturePageEffects";
import { IFeatureNamePageContext } from "../types/IFeatureNamePageContext";

export const FeatureNamePageContext = createContext<IFeatureNamePageContext | undefined>(undefined);

interface IFeatureNamePageProvider {
  children: ReactNode;
}

export const FeatureNamePageProvider = ({ children }: IFeatureNamePageProvider) => {
  // API hooks (only fetch operations)
  const companiesData = useFetchFeaturePageData();
  const userProfile = useFetchUserProfile();

  // Form hooks
  const form = useFeaturePageForm();

  // Handlers (mutations, business logic, no useEffect)
  const handlers = useFeaturePageHandlers();

  // Effects (non-fetch related useEffect logic only)
  useFeaturePageEffects({
    onUserActivity: () => {
      // Handle user activity tracking
      console.log("User is active");
    },
    onTimerExpiry: () => {
      // Handle timer expiry (e.g., session timeout warning)
      handlers.handleShowTimeoutWarning();
    },
    onExternalEvent: () => {
      // Handle external events (e.g., localStorage changes)
      handlers.handleExternalDataChange();
    },
  });

  const contextValue: IFeatureNamePageContext = {
    // API data
    companies: {
      data: companiesData.data,
      isLoading: companiesData.isLoading,
      error: companiesData.error,
      refetch: companiesData.refetch,
    },
    userProfile: {
      data: userProfile.data,
      isLoading: userProfile.isLoading,
      error: userProfile.error,
      refetch: userProfile.refetch,
    },
    // Form
    form,
    // Handlers (includes all mutations and business logic)
    handlers,
  };

  return (
    <FeatureNamePageContext.Provider value={contextValue}>
      {children}
    </FeatureNamePageContext.Provider>
  );
};
```

## Error Handling

- Use Zod for all runtime validation
- Implement error boundaries for unexpected errors
- Handle errors at the beginning of functions
- Use early returns for error conditions
- Provide meaningful error messages to users
- Handle 401 errors globally in RTK Query base query

### Error Boundary Component

```typescript
// components/ErrorBoundary/ErrorBoundary.tsx
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Component, ErrorInfo, ReactNode } from "react";

interface IErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface IErrorBoundary {
  children: ReactNode;
  fallback?: ReactNode;
}

export class ErrorBoundary extends Component<IErrorBoundary, IErrorBoundaryState> {
  constructor(props: IErrorBoundary) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): IErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <Card className="p-6 m-4 border-destructive">
          <CardContent>
            <p className="text-destructive mb-4">
              Something went wrong. Please try refreshing the page.
            </p>
            <Button 
              onClick={() => this.setState({ hasError: false })}
              variant="outline"
            >
              Try again
            </Button>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}
```

## Performance Optimization

- Use React.memo() for components that don't need frequent re-renders
- Implement code splitting with React.lazy() and Suspense
- Optimize shadcn/ui bundle size by importing components individually
- Use React Hook Form's built-in performance optimizations
- Leverage RTK Query's caching strategies

```typescript
// Code splitting example
const LazyFeaturePage = lazy(() => 
  import("./pages/FeatureNamePage").then(module => ({
    default: module.FeatureNamePage
  }))
);

// In your routes
<Suspense fallback={<CircularProgress />}>
  <LazyFeaturePage />
</Suspense>
```

## Authentication Architecture

### Session-Based Authentication
This project uses session-based authentication instead of token-based authentication:

- **Login Flow**: User credentials are sent to `/api/login` endpoint
- **Session Storage**: User profile data is stored in localStorage
- **Authentication Check**: Verified by presence of user data in localStorage
- **Logout**: Clears user data from localStorage and Redux state
- **No Tokens**: No JWT tokens or bearer authentication headers required

### Authentication API Structure
```typescript
// Login Request
interface ILoginRequest {
  username: string;
  password: string;
}

// Login Response (actual API response format)
interface ILoginResponse {
  userId: number;
  username: string;
  privileges: string[];
}
```

### Authentication State Management
```typescript
// User Profile stored in Redux and localStorage
interface IUserProfile {
  userId: number;
  username: string;
  privileges: string[];
}

// Auth state (no tokens needed)
interface IAuthState {
  isAuthenticated: boolean;
  user: IUserProfile | null;
  isLoading: boolean;
  error: string | null;
}
```

## Key Rules

### State Management Rules
- **Never use useState/useReducer** - use Redux slices instead
- **No API data duplication** - RTK Query is single source of truth
- **Access Redux directly** - use useSelector in components
- **Share through context** - RTK Query results and handlers only

### Hook Architecture Rules
- **API hooks**: Only for data fetching + refetch logic
- **Handlers**: Only for business logic + mutations (no useEffect)
- **Effects**: Only for non-fetch useEffect logic
- **Form object naming**: Always name the form object `form`

### Code Quality Rules
- Always use TypeScript with strict typing
- Follow the established directory structure
- Use consistent naming conventions
- Implement proper error handling
- Write accessible code with proper ARIA labels
- Use Tailwind CSS classes and shadcn/ui design tokens consistently

## Testing Guidelines

- Write unit tests using Jest and React Testing Library
- Test shadcn/ui components with accessibility queries
- Test form validation with Zod schemas and validation error handling
- Use React Router testing utilities for route testing
- Test Redux state changes and API calls
- Test Zod schema validation with both valid and invalid data

```typescript
// Example test
import { render, screen } from "@testing-library/react";
import { ComponentName } from "./ComponentName";

// Test component rendering

test('renders component correctly', () => {
  renderWithTheme(<ComponentName prop1="test" />);
  expect(screen.getByRole('button')).toBeInTheDocument();
});
```

## Security Guidelines

- Sanitize user inputs to prevent XSS attacks
- Use Zod for robust input validation
- Implement proper authentication checks in protected routes
- Follow security best practices for handling sensitive data

## Documentation References

- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [React Router v7 Documentation](https://reactrouter.com/dev/)
- [React Hook Form Documentation](https://react-hook-form.com/)
- [Zod Documentation](https://zod.dev/)
- [Redux Toolkit Documentation](https://redux-toolkit.js.org/)

## Code Generation Examples

When generating code, follow these patterns:

### Component Generation
```typescript
```typescript
// For components WITH props:
// apps/main/src/components/ComponentName/ComponentName.tsx
import { Box } from "@mui/material";
import { IComponentName } from "./IComponentName";

export const ComponentName = ({ prop1, prop2 }: IComponentName) => {
  return (
    <Card className="p-4">
      {/* Component content */}
    </Card>
  );
};
```

// For components WITHOUT props (no interface needed):
// apps/main/src/components/ComponentName/ComponentName.tsx
import { Card } from "./ui/card";

export const ComponentName = () => {
  return (
    <Card className="p-4">
      {/* Component content */}
    </Card>
  );
};
```

### Page Generation
```typescript
// apps/main/src/pages/FeatureNamePage/FeatureNamePage.tsx
import { ProtectedRoute } from "../../utils/ProtectedRoute";
import { FeatureNamePageProvider } from "./context/FeatureNamePageProvider";
import { FeatureNamePageContainer } from "./FeatureNamePageContainer";

export const FeatureNamePage = () => {
  return (
    <ProtectedRoute>
      <FeatureNamePageProvider>
        <FeatureNamePageContainer />
      </FeatureNamePageProvider>
    </ProtectedRoute>
  );
};
```

### API Hook Generation
```typescript
// apps/main/src/pages/FeatureNamePage/context/hooks/api/useFetchFeaturePageData.ts
import { useGetFeatureDataQuery } from "../../../../../store/api/FeatureName/FeatureNameApi";

export const useFetchFeaturePageData = () => {
  const queryResult = useGetFeatureDataQuery();
  
  // Fetch-related effects only
  useEffect(() => {
    queryResult.refetch();
  }, [location.pathname]);

  return queryResult;
};
```

### Page Layout Organization

Pages should follow a consistent layout structure using shadcn/ui components:

```typescript
export const FeatureNamePageContainer = () => {
  const { data, handlers } = useFeaturePageContext();
  const isLoading = useSelector(selectIsLoading);

  // Early returns for loading and error states
  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (data.error) {
    return (
      <Card className="m-4 border-destructive">
        <CardContent className="p-4">
          <p className="text-destructive">Error loading data</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 bg-background border-b">
        <div className="flex items-center justify-between p-4">
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Feature Name
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
          <Typography variant="h4" gutterBottom>
            Page Title
          </Typography>
          
          {/* Content sections */}
          <Grid2 container spacing={3}>
            <Grid2 xs={12} md={8}>
              {/* Main content */}
            </Grid2>
            <Grid2 xs={12} md={4}>
              {/* Sidebar content */}
            </Grid2>
          </Grid2>
        </Paper>
      </Container>

      {/* Fixed Bottom Actions (if needed) */}
      <Box sx={{ 
        position: 'fixed', 
        bottom: 0, 
        left: 0, 
        right: 0, 
        p: 2, 
        bgcolor: 'background.paper',
        borderTop: 1,
        borderColor: 'divider'
      }}>
        <Button variant="contained" fullWidth>
          Action Button
        </Button>
      </Box>
    </Box>
  );
};
```

Always generate code that follows these patterns and maintains consistency with the established architecture.
