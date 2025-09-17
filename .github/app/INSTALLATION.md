# ChittyAssets GitHub App Installation Guide

## Overview

The ChittyAssets Bot is a GitHub App that provides automated management for the ChittyAssets repository, including:

- 🚀 CI/CD pipeline automation
- 🔒 Security scanning and vulnerability detection
- 📦 Dependency updates and management
- 📊 Notion Command Center synchronization
- 🏷️ Auto-labeling and issue management
- ✅ Automated checks and validations
- 📝 Audit logging and compliance

## Quick Installation

### Method 1: Automated Script (Recommended)

```bash
# Run the installation script
node scripts/install-github-app.js
```

This script will:
1. Guide you through the installation process
2. Create or configure the GitHub App
3. Save credentials securely
4. Set up webhook endpoints

### Method 2: Manual Installation

#### Step 1: Create GitHub App

1. Go to [GitHub Apps Settings](https://github.com/settings/apps)
2. Click "New GitHub App"
3. Fill in the required fields:

**Basic Information:**
- **Name**: ChittyAssets Bot
- **Homepage URL**: https://assets.chitty.cc
- **Description**: Automated management bot for ChittyAssets

**Webhook:**
- **Webhook URL**: https://assets.chitty.cc/api/github/webhooks
- **Webhook secret**: Generate a secure random string
- **Active**: ✅ Checked

**Permissions:**

Repository permissions:
- Actions: Write
- Administration: Read
- Checks: Write
- Contents: Write
- Deployments: Write
- Environments: Write
- Issues: Write
- Metadata: Read
- Packages: Write
- Pages: Write
- Pull requests: Write
- Repository hooks: Write
- Repository projects: Write
- Security events: Write
- Statuses: Write
- Vulnerability alerts: Read

**Subscribe to events:**
- Check run
- Check suite
- Create
- Delete
- Deployment
- Deployment status
- Issues
- Issue comment
- Pull request
- Pull request review
- Pull request review comment
- Push
- Release
- Repository
- Workflow dispatch
- Workflow run

#### Step 2: Install on Repository

1. After creating the app, click "Install App"
2. Select the ChittyAssets repository
3. Click "Install"

#### Step 3: Configure Secrets

Add these secrets to your repository:

```bash
# GitHub Repository Settings → Secrets and variables → Actions

GITHUB_APP_ID=<your-app-id>
GITHUB_APP_PRIVATE_KEY=<contents-of-private-key.pem>
GITHUB_APP_WEBHOOK_SECRET=<your-webhook-secret>
```

#### Step 4: Local Development Setup

Create `.env` file:

```bash
# GitHub App Configuration
GITHUB_APP_ID=123456
GITHUB_APP_CLIENT_ID=Iv1.abc123def456
GITHUB_APP_CLIENT_SECRET=your-client-secret
GITHUB_APP_WEBHOOK_SECRET=your-webhook-secret
```

Save private key:

```bash
# Save the private key to .github/app/private-key.pem
# Set restrictive permissions
chmod 600 .github/app/private-key.pem
```

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GITHUB_APP_ID` | Your GitHub App ID | Yes |
| `GITHUB_APP_PRIVATE_KEY` | Private key for authentication | Yes |
| `GITHUB_APP_WEBHOOK_SECRET` | Secret for webhook validation | Yes |
| `GITHUB_APP_CLIENT_ID` | OAuth App client ID | For OAuth |
| `GITHUB_APP_CLIENT_SECRET` | OAuth App client secret | For OAuth |

### Webhook Configuration

The app listens for webhooks at:
- **Production**: `https://assets.chitty.cc/api/github/webhooks`
- **Staging**: `https://staging-assets.chitty.cc/api/github/webhooks`
- **Development**: `https://dev-assets.chitty.cc/api/github/webhooks`

### Testing Webhooks Locally

Use ngrok for local webhook testing:

```bash
# Install ngrok
npm install -g ngrok

# Start local server
npm run dev

# In another terminal, expose local port
ngrok http 5000

# Update GitHub App webhook URL to ngrok URL
# e.g., https://abc123.ngrok.io/api/github/webhooks
```

## Features

### 1. Automated CI/CD

The bot automatically:
- Runs tests on pull requests
- Deploys to staging on merge to develop
- Deploys to production on merge to main
- Posts deployment status updates

### 2. Security Scanning

- Scans dependencies for vulnerabilities
- Checks for exposed secrets
- Validates security policies
- Creates security advisories

### 3. Pull Request Management

- Auto-labels based on changed files
- Assigns reviewers based on CODEOWNERS
- Checks PR description completeness
- Validates commit messages

### 4. Issue Management

- Auto-responds to new issues
- Labels issues based on content
- Links related issues and PRs
- Tracks issue metrics

### 5. Notion Sync

- Syncs repository metadata
- Updates project status
- Logs activity timeline
- Tracks metrics and KPIs

## Usage

### Triggering Actions via Comments

```bash
# In PR comments:
/deploy staging    # Deploy to staging
/deploy production # Deploy to production
/run tests        # Run test suite
/update deps      # Update dependencies
/sync notion      # Trigger Notion sync
```

### Repository Dispatch Events

```bash
# Trigger custom events via API
curl -X POST \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/repos/chittyos/chittyassets/dispatches \
  -d '{"event_type":"deploy","client_payload":{"environment":"staging"}}'
```

### Webhook Events

The app responds to these webhook events:

| Event | Action |
|-------|--------|
| `push` | Trigger CI/CD, sync Notion |
| `pull_request` | Run checks, auto-label |
| `issues` | Auto-respond, categorize |
| `workflow_run` | Monitor status, notify failures |
| `check_run` | Update PR status |
| `deployment` | Track deployment status |

## Monitoring

### Health Check

```bash
# Check app status
curl https://assets.chitty.cc/api/github/setup
```

### Webhook Logs

View webhook deliveries:
1. Go to Settings → Developer settings → GitHub Apps
2. Select your app
3. Click "Advanced" → "Recent Deliveries"

### Metrics

The app tracks:
- Webhook delivery success rate
- Response times
- Error rates
- Activity logs

## Troubleshooting

### Common Issues

#### 1. Webhook Not Receiving Events

- Verify webhook URL is accessible
- Check webhook secret matches
- Ensure app is installed on repository
- Review webhook delivery logs

#### 2. Authentication Failures

- Verify private key is correct
- Check app ID matches
- Ensure permissions are granted
- Validate JWT token generation

#### 3. Permission Denied

- Review app permissions
- Reinstall app on repository
- Check repository settings
- Verify installation ID

### Debug Mode

Enable debug logging:

```javascript
// In your code
process.env.DEBUG = 'github:*';
```

### Testing

```bash
# Run GitHub App tests
npm run test:github-app

# Test webhook signature
npm run test:webhook

# Validate configuration
npm run validate:github-app
```

## Security

### Best Practices

1. **Rotate secrets regularly**
   - Webhook secret: Every 90 days
   - Private key: Every year
   - Client secret: Every 6 months

2. **Limit permissions**
   - Only request needed permissions
   - Use fine-grained PATs
   - Implement least privilege

3. **Validate webhooks**
   - Always verify signatures
   - Check sender identity
   - Validate payload structure

4. **Secure storage**
   - Never commit secrets
   - Use environment variables
   - Encrypt sensitive data

### Audit Log

All actions are logged with:
- Timestamp
- Event type
- Actor
- Repository
- Payload hash

## Advanced Configuration

### Custom Workflows

Create `.github/chittybot.yml`:

```yaml
version: 1
rules:
  - name: Auto-merge Dependabot
    conditions:
      - author = dependabot[bot]
      - status-check = success
    actions:
      - merge

  - name: Request review
    conditions:
      - files ~= "*.ts"
    actions:
      - request-review: ["@chittyos/developers"]

  - name: Auto-label
    conditions:
      - files ~= "docs/*"
    actions:
      - add-label: "documentation"
```

### Rate Limits

The app respects GitHub rate limits:
- REST API: 5,000 requests/hour
- GraphQL: 5,000 points/hour
- Webhook: No limit

## Support

### Resources

- [GitHub Apps Documentation](https://docs.github.com/apps)
- [Webhook Events Reference](https://docs.github.com/webhooks)
- [ChittyAssets Issues](https://github.com/chittyos/chittyassets/issues)

### Getting Help

1. Check this documentation
2. Review [GitHub App logs](#webhook-logs)
3. Open an issue with `github-app` label
4. Contact ChittyOS support

## License

The ChittyAssets Bot is part of the ChittyAssets project and follows the same MIT license.