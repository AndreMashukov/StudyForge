# Monitoring and Alerting Setup

This document outlines the monitoring and alerting configuration for the Code Insights AI deployment pipeline.

## Overview

The monitoring stack includes:
- **GitHub Actions**: Workflow monitoring and notifications
- **Firebase Console**: Application performance and error tracking
- **Custom Health Checks**: Application-specific monitoring
- **Alerting**: Notifications for failures and issues

## GitHub Actions Monitoring

### Workflow Status Tracking
The deployment pipeline automatically tracks:
- Build success/failure rates
- Test pass/fail status
- Deployment success/failure
- Performance metrics

### Built-in Notifications
GitHub provides automatic notifications for:
- Failed workflow runs
- Deployment status changes
- Security alerts
- Pull request status

### Custom Workflow Notifications
Add Slack integration to workflows (optional):

```yaml
- name: Notify on failure
  if: failure()
  uses: 8398a7/action-slack@v3
  with:
    status: failure
    text: |
      🚨 Deployment failed!
      Repository: ${{ github.repository }}
      Branch: ${{ github.ref }}
      Commit: ${{ github.sha }}
      Author: ${{ github.actor }}
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

## Firebase Console Monitoring

### Application Performance Monitoring
Firebase automatically provides:
- **Performance Monitoring**: Page load times, network requests
- **Crashlytics**: Error tracking and crash reporting
- **Analytics**: User behavior and app usage

### Functions Monitoring
Firebase Functions provide built-in monitoring for:
- Execution times
- Error rates
- Memory usage
- Invocation counts

### Database Monitoring
Firestore provides metrics for:
- Read/write operations
- Query performance
- Connection counts
- Storage usage

## Health Check Implementation

### Frontend Health Check
Add a health check endpoint in your React app:

```typescript
// web/src/components/HealthCheck.tsx
export const HealthCheck = () => {
  const [status, setStatus] = useState<'healthy' | 'unhealthy'>('healthy');

  useEffect(() => {
    const checkHealth = async () => {
      try {
        // Check Firebase connection
        await firebase.auth().currentUser;
        // Check API endpoints
        // Add other health checks
        setStatus('healthy');
      } catch (error) {
        console.error('Health check failed:', error);
        setStatus('unhealthy');
      }
    };

    checkHealth();
  }, []);

  return (
    <div data-testid="health-status" data-status={status}>
      Status: {status}
    </div>
  );
};
```

### Backend Health Check
Add health check to Firebase Functions:

```typescript
// functions/src/index.ts
export const healthCheck = functions.https.onRequest((req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      firestore: 'healthy',
      gemini: 'healthy'
    }
  };

  // Test Firestore connection
  try {
    admin.firestore().collection('_health').limit(1).get();
  } catch (error) {
    health.services.firestore = 'unhealthy';
    health.status = 'unhealthy';
  }

  // Test Gemini API
  // Add Gemini API test if needed

  res.status(health.status === 'healthy' ? 200 : 503).json(health);
});
```

## Smoke Tests

### Post-Deployment Verification
Add smoke tests to verify deployment:

```javascript
// scripts/smoke-tests.js
const axios = require('axios');

async function runSmokeTests() {
  const baseUrl = process.env.APP_URL || 'https://code-insights-quiz-ai.web.app';
  
  try {
    // Test homepage loads
    const homepageResponse = await axios.get(baseUrl);
    if (homepageResponse.status !== 200) {
      throw new Error(`Homepage failed: ${homepageResponse.status}`);
    }

    // Test health endpoint
    const healthResponse = await axios.get(`${baseUrl}/health`);
    if (healthResponse.data.status !== 'healthy') {
      throw new Error('Health check failed');
    }

    // Test API endpoints
    const apiResponse = await axios.get(`${baseUrl}/api/health`);
    if (apiResponse.status !== 200) {
      throw new Error('API health check failed');
    }

    console.log('✅ All smoke tests passed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Smoke tests failed:', error.message);
    process.exit(1);
  }
}

runSmokeTests();
```

### Integration with GitHub Actions
Add smoke tests to your deployment workflow:

```yaml
- name: Run smoke tests
  run: |
    npm install -g axios
    node scripts/smoke-tests.js
  env:
    APP_URL: https://code-insights-quiz-ai.web.app
```

## Performance Monitoring

### Core Web Vitals
Monitor key performance metrics:
- **Largest Contentful Paint (LCP)**: Loading performance
- **First Input Delay (FID)**: Interactivity
- **Cumulative Layout Shift (CLS)**: Visual stability

### Bundle Size Monitoring
Track bundle size changes:

```yaml
- name: Bundle size analysis
  run: |
    npm install -g bundlesize
    bundlesize
```

Add to `package.json`:
```json
{
  "bundlesize": [
    {
      "path": "dist/web/**/*.js",
      "maxSize": "500kb"
    }
  ]
}
```

## Error Tracking

### Frontend Error Tracking
Implement error boundary with reporting:

```typescript
// web/src/components/ErrorBoundary.tsx
export class ErrorBoundary extends Component<Props, State> {
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to console for development
    console.error('Error caught by boundary:', error, errorInfo);
    
    // Report to monitoring service (e.g., Sentry, Firebase Crashlytics)
    // analytics.logError(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-fallback">
          <h2>Something went wrong.</h2>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            {this.state.error && this.state.error.toString()}
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### Backend Error Tracking
Use Firebase Functions error reporting:

```typescript
// functions/src/utils/errorHandler.ts
export const handleError = (error: Error, context: string) => {
  console.error(`Error in ${context}:`, error);
  
  // Report to Firebase Crashlytics or external service
  functions.logger.error(error, { context });
};
```

## Alerting Setup

### GitHub Notifications
Configure repository notifications:
1. Go to repository Settings → Notifications
2. Enable notifications for:
   - Failed Actions
   - Security alerts
   - Dependency vulnerabilities

### Firebase Alerts
Set up Firebase Console alerts:
1. Go to Firebase Console → Alerts
2. Create alerts for:
   - Function error rate > 5%
   - Response time > 2 seconds
   - Daily active users drop > 20%

### Custom Alerts (Optional)
For advanced alerting, integrate with services like:
- **Slack**: Webhook notifications
- **PagerDuty**: Incident management
- **Email**: Critical failure notifications

## Dashboard Setup

### GitHub Insights
Use GitHub's built-in insights:
- Actions tab: Workflow success rates
- Insights tab: Code frequency, contributors
- Security tab: Vulnerability alerts

### Firebase Console Dashboard
Monitor key metrics:
- **Performance**: App performance data
- **Analytics**: User engagement
- **Functions**: Execution metrics
- **Database**: Usage statistics

### Custom Dashboard (Optional)
Create a simple monitoring dashboard:

```typescript
// web/src/components/MonitoringDashboard.tsx
export const MonitoringDashboard = () => {
  const [metrics, setMetrics] = useState({
    deploymentStatus: 'unknown',
    lastDeploy: null,
    errorRate: 0,
    responseTime: 0
  });

  useEffect(() => {
    // Fetch metrics from Firebase or GitHub API
    fetchMetrics().then(setMetrics);
  }, []);

  return (
    <div className="monitoring-dashboard">
      <h2>System Status</h2>
      <div className="metrics-grid">
        <MetricCard
          title="Deployment Status"
          value={metrics.deploymentStatus}
          status={metrics.deploymentStatus === 'success' ? 'good' : 'bad'}
        />
        <MetricCard
          title="Error Rate"
          value={`${metrics.errorRate}%`}
          status={metrics.errorRate < 1 ? 'good' : 'warning'}
        />
      </div>
    </div>
  );
};
```

## Maintenance and Reviews

### Weekly Reviews
- Check deployment success rates
- Review error logs and patterns
- Update alert thresholds if needed
- Verify monitoring service health

### Monthly Reviews
- Analyze performance trends
- Update smoke tests for new features
- Review and optimize monitoring costs
- Update documentation

### Incident Response
1. **Immediate Response**: Check health endpoints
2. **Investigation**: Review logs and metrics
3. **Resolution**: Apply fixes and deploy
4. **Post-Mortem**: Document lessons learned

## Implementation Checklist

- [ ] Set up GitHub repository notifications
- [ ] Configure Firebase Console alerts
- [ ] Implement health check endpoints
- [ ] Add smoke tests to deployment pipeline
- [ ] Set up error tracking and reporting
- [ ] Create monitoring dashboard (optional)
- [ ] Document incident response procedures
- [ ] Test alerting mechanisms
- [ ] Schedule regular monitoring reviews

## Tools and Resources

### Monitoring Tools
- **GitHub Actions**: Built-in workflow monitoring
- **Firebase Console**: Application monitoring
- **Google Analytics**: User behavior tracking
- **Lighthouse CI**: Performance monitoring

### External Services (Optional)
- **Sentry**: Error tracking and performance monitoring
- **Datadog**: Infrastructure monitoring
- **New Relic**: Application performance monitoring
- **PagerDuty**: Incident management

### Documentation
- [Firebase Performance Monitoring](https://firebase.google.com/docs/perf-mon)
- [GitHub Actions Monitoring](https://docs.github.com/en/actions/monitoring-and-troubleshooting-workflows)
- [Web Vitals](https://web.dev/vitals/)

This monitoring setup provides comprehensive coverage for your deployment pipeline while keeping it simple and maintainable.