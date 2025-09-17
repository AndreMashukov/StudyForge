# Branch Protection and Deployment Gates

This document outlines the recommended branch protection rules and deployment gates for the Code Insights AI project.

## Branch Protection Rules

### Main Branch Protection
Configure the following protection rules for the `main` branch in GitHub:

1. **Go to Repository Settings → Branches**
2. **Add Rule for `main` branch**

#### Required Settings:
```
✅ Require a pull request before merging
   ✅ Require approvals (1)
   ✅ Dismiss stale reviews when new commits are pushed
   ✅ Require review from code owners

✅ Require status checks to pass before merging
   ✅ Require branches to be up to date before merging
   Required status checks:
   - test (from CI workflow)
   - code-quality (from quality workflow)
   - security-audit (from quality workflow)

✅ Require conversation resolution before merging

✅ Restrict pushes that create files larger than 100 MB

✅ Do not allow bypassing the above settings
```

## CODEOWNERS File

Create a `.github/CODEOWNERS` file to require code review:

```
# Global code owners
* @AndreMashukov

# Frontend code
/web/ @AndreMashukov
/web/src/components/ @AndreMashukov

# Backend code
/functions/ @AndreMashukov

# Infrastructure and deployment
/.github/ @AndreMashukov
/firebase.json @AndreMashukov
/.firebaserc @AndreMashukov

# Documentation
*.md @AndreMashukov
```

## Deployment Gates

### Automated Quality Gates
The following checks must pass before deployment:

1. **Code Quality Checks**:
   - ESLint passes with no errors
   - TypeScript compilation succeeds
   - Prettier formatting is correct
   - All unit tests pass

2. **Security Checks**:
   - Dependency audit passes (moderate+ vulnerabilities)
   - No secrets detected in code
   - Bundle size analysis completes

3. **Build Verification**:
   - Web app builds successfully for production
   - Firebase Functions build successfully
   - No circular dependencies detected

### Manual Approval Gates
For sensitive changes, consider requiring manual approval:

1. **Infrastructure Changes**: Changes to `.github/`, `firebase.json`, deployment scripts
2. **Security-Related**: Authentication logic, security rules, API configurations
3. **Production Hotfixes**: Emergency deployments bypassing normal flow

## GitHub Environments

### Production Environment Protection
1. **Go to Repository Settings → Environments**
2. **Create `production` environment** with:
   ```
   ✅ Required reviewers: @AndreMashukov
   ✅ Wait timer: 0 minutes
   ✅ Deployment branches: Selected branches (main only)
   ```

### Environment Secrets
Configure these secrets in the `production` environment:
- `FIREBASE_SERVICE_ACCOUNT_CODE_INSIGHTS_QUIZ_AI`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_GEMINI_API_KEY`

## Workflow Configuration

### Required Status Checks
Update your workflows to provide these status check names:
- `test` - Main testing job
- `code-quality` - Code quality and formatting
- `security-audit` - Security and dependency checks

### Deployment Approval
For production deployments, add manual approval:

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production  # This triggers approval requirement
    steps:
      # deployment steps
```

## Emergency Procedures

### Hotfix Process
For critical production issues:

1. **Create hotfix branch** from `main`:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b hotfix/critical-issue
   ```

2. **Make minimal fix**
3. **Create PR** with `[HOTFIX]` label
4. **Expedited review** (can bypass some checks if configured)
5. **Deploy immediately** after merge

### Rollback Process
If deployment issues occur:

1. **Immediate rollback** using Firebase Console:
   - Go to Hosting → View
   - Select previous version
   - Click "Rollback"

2. **Git revert** for code changes:
   ```bash
   git revert [commit-hash]
   git push origin main
   ```

## Monitoring Integration

### Status Checks Integration
Ensure workflows report status back to GitHub:

```yaml
- name: Report Status
  if: always()
  uses: actions/github-script@v7
  with:
    script: |
      github.rest.repos.createCommitStatus({
        owner: context.repo.owner,
        repo: context.repo.repo,
        sha: context.sha,
        state: '${{ job.status }}',
        context: 'deployment/production',
        description: 'Production deployment status'
      });
```

## Best Practices

### Pull Request Template
Create `.github/pull_request_template.md`:

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix (non-breaking change)
- [ ] New feature (non-breaking change)
- [ ] Breaking change
- [ ] Documentation update
- [ ] Infrastructure change

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Security
- [ ] No new security vulnerabilities
- [ ] No secrets in code
- [ ] Authentication/authorization considered

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No console.log statements in production code
```

### Commit Message Convention
Encourage conventional commits:
- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `ci:` CI/CD changes
- `refactor:` Code refactoring
- `test:` Test changes

## Implementation Steps

1. **Set up branch protection** in GitHub repository settings
2. **Create CODEOWNERS** file with appropriate reviewers
3. **Configure production environment** with required reviewers
4. **Update workflow files** to use environment protection
5. **Create pull request template** for consistent PR information
6. **Test the protection** by creating a test PR
7. **Document emergency procedures** for the team

## Maintenance

### Regular Reviews
- **Weekly**: Review failed deployments and improve gates
- **Monthly**: Update dependency security checks
- **Quarterly**: Review and update protection rules
- **As needed**: Add new status checks for new quality measures

### Metrics to Track
- Deployment success rate
- Time from PR to production
- Number of rollbacks
- Security vulnerabilities detected
- Code coverage trends