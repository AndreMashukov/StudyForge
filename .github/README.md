# GitHub Configuration

This directory contains GitHub-specific configuration files for the Code Insights AI project.

## Files Overview

### Workflows (`.github/workflows/`)
- **`ci.yml`**: Continuous Integration - runs tests and code quality checks
- **`firebase-hosting-merge.yml`**: Production deployment workflow
- **`quality.yml`**: Comprehensive code quality, security, and performance checks

### Configuration Files
- **`CODEOWNERS`**: Defines code review requirements for different parts of the repository
- **`dependabot.yml`**: (Optional) Automated dependency updates

### Documentation
- **`DEPLOYMENT.md`**: Complete deployment setup and configuration guide
- **`BRANCH_PROTECTION.md`**: Branch protection rules and deployment gates
- **`MONITORING.md`**: Monitoring and alerting setup guide

## Quick Setup

1. **Configure GitHub Secrets**:
   ```
   FIREBASE_SERVICE_ACCOUNT_CODE_INSIGHTS_QUIZ_AI
   VITE_FIREBASE_API_KEY
   VITE_FIREBASE_AUTH_DOMAIN
   VITE_FIREBASE_PROJECT_ID
   VITE_FIREBASE_STORAGE_BUCKET
   VITE_FIREBASE_MESSAGING_SENDER_ID
   VITE_FIREBASE_APP_ID
   VITE_GEMINI_API_KEY
   ```

2. **Set up Branch Protection**:
   - Go to Repository Settings → Branches
   - Add protection rule for `main` branch
   - Require status checks: `test`, `code-quality`, `security-audit`

3. **Enable Actions**:
   - Go to Repository Settings → Actions
   - Allow all actions and reusable workflows

## Deployment Process

1. **Push to `main`** triggers automatic deployment
2. **Tests must pass** before deployment proceeds  
3. **Both web app and functions** are deployed together
4. **Manual deployment** available via GitHub Actions tab

## Getting Help

- Review `DEPLOYMENT.md` for setup instructions
- Check `BRANCH_PROTECTION.md` for security configuration
- See `MONITORING.md` for observability setup
- Contact @AndreMashukov for access and permissions

## Maintenance

- **Weekly**: Review failed workflows and deployment metrics
- **Monthly**: Update dependencies and security checks
- **As needed**: Adjust branch protection rules and deployment gates